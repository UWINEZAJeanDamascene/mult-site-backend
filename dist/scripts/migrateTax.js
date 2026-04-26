"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const mongoose_1 = __importDefault(require("mongoose"));
const models_1 = require("../models");
async function migrateTax() {
    try {
        const uri = process.env.DATABASE_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017';
        await mongoose_1.default.connect(uri);
        console.log('Connected to MongoDB\n');
        // Fix POs with taxRate > 0 but taxAmount = 0
        const posToFix = await models_1.PurchaseOrder.find({
            taxRate: { $gt: 0 },
            taxAmount: 0,
        });
        console.log(`Found ${posToFix.length} POs to fix`);
        let poFixed = 0;
        for (const po of posToFix) {
            const subTotal = po.subTotal || po.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
            const taxAmount = subTotal * (po.taxRate / 100);
            const totalAmount = subTotal + taxAmount;
            await models_1.PurchaseOrder.updateOne({ _id: po._id }, {
                $set: {
                    subTotal,
                    taxAmount,
                    totalAmount,
                },
            });
            poFixed++;
            console.log(`Fixed PO ${po.poNumber}: subTotal=${subTotal}, tax=${taxAmount}, total=${totalAmount}`);
        }
        // Fix DNs with taxRate > 0 but taxAmount = 0
        const dnsToFix = await models_1.DeliveryNote.find({
            taxRate: { $gt: 0 },
            taxAmount: 0,
        });
        console.log(`\nFound ${dnsToFix.length} Delivery Notes to fix`);
        let dnFixed = 0;
        for (const dn of dnsToFix) {
            const subTotal = dn.subTotal || dn.items.reduce((sum, item) => sum + ((item.quantityDelivered || 0) * (item.unitPrice || 0)), 0);
            const taxRate = dn.taxRate || 0;
            const taxAmount = subTotal * (taxRate / 100);
            const totalAmount = subTotal + taxAmount;
            await models_1.DeliveryNote.updateOne({ _id: dn._id }, {
                $set: {
                    subTotal,
                    taxAmount,
                    totalAmount,
                },
            });
            dnFixed++;
            console.log(`Fixed DN ${dn.dnNumber}: subTotal=${subTotal}, tax=${taxAmount}, total=${totalAmount}`);
        }
        console.log(`\nMigration complete:`);
        console.log(`  POs fixed: ${poFixed}`);
        console.log(`  DNs fixed: ${dnFixed}`);
        await mongoose_1.default.disconnect();
        process.exit(0);
    }
    catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}
migrateTax();
//# sourceMappingURL=migrateTax.js.map