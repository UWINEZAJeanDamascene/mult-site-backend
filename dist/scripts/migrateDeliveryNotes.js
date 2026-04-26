"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const mongoose_1 = __importDefault(require("mongoose"));
const models_1 = require("../models");
async function tryDatabase(baseUri, dbName) {
    try {
        // Properly insert database name into URI
        let uri;
        if (baseUri.includes('?')) {
            // Has query params - insert db name before ?
            uri = baseUri.replace(/\?(.*)$/, `/${dbName}?$1`);
        }
        else if (baseUri.match(/\/\w+$/)) {
            // Already has a path - replace it
            uri = baseUri.replace(/\/[^/]*$/, `/${dbName}`);
        }
        else {
            // No path - add db name
            uri = `${baseUri}/${dbName}`;
        }
        console.log(`  Trying: ${uri.substring(0, 60)}...`);
        const conn = await mongoose_1.default.createConnection(uri).asPromise();
        const db = conn.db;
        const collection = db?.collection('deliverynotes');
        const count = await collection?.countDocuments({}) || 0;
        console.log(`Database '${dbName}': ${count} delivery notes`);
        if (count > 0) {
            const docs = await collection?.find({}).toArray() || [];
            await conn.close();
            return docs;
        }
        await conn.close();
        return [];
    }
    catch (e) {
        console.log(`Database '${dbName}': error - ${e}`);
        return [];
    }
}
async function migrateDeliveryNotes() {
    try {
        const baseUri = process.env.DATABASE_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017';
        console.log(`Using URI: ${baseUri.substring(0, 50)}...\n`);
        // Connect directly to the provided URI
        console.log(`Connecting to MongoDB...`);
        const conn = await mongoose_1.default.createConnection(baseUri).asPromise();
        const db = conn.db;
        const dbName = db?.databaseName || 'unknown';
        console.log(`Connected to database: ${dbName}`);
        // Check deliverynotes collection
        const collection = db?.collection('deliverynotes');
        const count = await collection?.countDocuments({}) || 0;
        console.log(`Found ${count} delivery notes`);
        if (count === 0) {
            // List all collections
            const collections = await db?.listCollections().toArray();
            console.log('Available collections:', collections?.map((c) => c.name).join(', '));
            await conn.close();
            process.exit(0);
        }
        const deliveryNotes = await collection?.find({}).toArray() || [];
        await conn.close();
        // Connect to main database for creating SiteRecords
        const mainUri = process.env.DATABASE_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/construction_stock';
        await mongoose_1.default.connect(mainUri);
        console.log(`Connected to main database for writing SiteRecords\n`);
        let createdCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        for (const dn of deliveryNotes) {
            try {
                // Check if site records already exist for this delivery note (check all companies)
                const existingRecords = await models_1.SiteRecord.countDocuments({
                    notes: { $regex: `Delivered via ${dn.dnNumber}` },
                });
                if (existingRecords > 0) {
                    console.log(`Skipping ${dn.dnNumber} - site records already exist`);
                    skippedCount++;
                    continue;
                }
                // Get the PO to find the recordedBy user
                const po = await models_1.PurchaseOrder.findById(dn.poId).lean();
                const recordedBy = dn.receivedBy || po?.createdBy || new mongoose_1.default.Types.ObjectId();
                // Create site records for each delivered item
                const siteRecordPromises = dn.items
                    .filter((item) => item.quantityDelivered > 0)
                    .map((item) => models_1.SiteRecord.create({
                    site_id: dn.site_id,
                    material_id: item.material_id || undefined,
                    materialName: item.materialName,
                    quantityReceived: item.quantityDelivered,
                    quantityUsed: 0,
                    date: new Date(dn.deliveryDate),
                    notes: `Delivered via ${dn.dnNumber}. ${item.notes || ''}`,
                    recordedBy: recordedBy,
                    company_id: dn.company_id,
                    syncedToMainStock: false,
                }));
                await Promise.all(siteRecordPromises);
                createdCount += siteRecordPromises.length;
                console.log(`Migrated ${dn.dnNumber} - created ${siteRecordPromises.length} site records`);
            }
            catch (error) {
                console.error(`Error migrating ${dn.dnNumber}:`, error);
                errorCount++;
            }
        }
        console.log('\nMigration complete:');
        console.log(`  Created: ${createdCount} site records`);
        console.log(`  Skipped: ${skippedCount} delivery notes (already migrated)`);
        console.log(`  Errors: ${errorCount}`);
        await mongoose_1.default.disconnect();
        console.log('Disconnected from MongoDB');
        process.exit(0);
    }
    catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}
// Run migration
migrateDeliveryNotes();
//# sourceMappingURL=migrateDeliveryNotes.js.map