"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("../src/config/mongoose");
const models_1 = require("../src/models");
const COMPANY_ID = 'CTS';
async function main() {
    console.log('Connecting to MongoDB...');
    await (0, mongoose_1.connectDB)();
    console.log('Seeding database...');
    // Check if main manager already exists
    const existingManager = await models_1.User.findOne({
        role: 'main_manager',
        company_id: COMPANY_ID,
    });
    if (existingManager) {
        console.log('Main manager already exists, skipping seed...');
        await (0, mongoose_1.disconnectDB)();
        return;
    }
    // Create default main manager (password will be hashed via pre-save hook)
    const manager = await models_1.User.create({
        email: 'admin@lilstock.com',
        password: 'admin123', // Will be hashed automatically
        name: 'Main Manager',
        role: 'main_manager',
        company_id: COMPANY_ID,
        isActive: true,
    });
    console.log('Created main manager:');
    console.log('  Email: admin@lilstock.com');
    console.log('  Password: admin123');
    console.log('  ID:', manager._id.toString());
    // Create sample materials (master catalog)
    const materials = await models_1.Material.create([
        { name: 'Cement', unit: 'kg', description: 'Portland cement', company_id: COMPANY_ID },
        { name: 'Steel Rebar', unit: 'meters', description: 'Reinforcement bars', company_id: COMPANY_ID },
        { name: 'Bricks', unit: 'pcs', description: 'Standard bricks', company_id: COMPANY_ID },
        { name: 'Sand', unit: 'kg', description: 'Construction sand', company_id: COMPANY_ID },
    ]);
    console.log('Created sample materials:');
    materials.forEach(m => console.log(`  - ${m.name} (${m.unit})`));
    // Create sample sites
    const sites = await models_1.Site.create([
        {
            name: 'Site 1 - Downtown Construction',
            location: 'Downtown District',
            description: 'First construction site',
            company_id: COMPANY_ID,
            createdBy: manager._id,
            isActive: true,
        },
        {
            name: 'Site 2 - Industrial Park',
            location: 'Industrial Zone',
            description: 'Second construction site',
            company_id: COMPANY_ID,
            createdBy: manager._id,
            isActive: true,
        },
    ]);
    console.log('Created sample sites:');
    sites.forEach(s => console.log(`  - ${s.name}`));
    console.log('\nSeed completed successfully!');
    console.log('\nYou can now login with:');
    console.log('  POST http://localhost:3000/api/auth/login');
    console.log('  Body: { "email": "admin@lilstock.com", "password": "admin123", "company_id": "CTS" }');
    await (0, mongoose_1.disconnectDB)();
}
main()
    .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
});
//# sourceMappingURL=seed.js.map