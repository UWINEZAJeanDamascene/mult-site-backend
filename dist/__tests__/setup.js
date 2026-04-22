"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../config/database");
beforeAll(async () => {
    // Connect to test database
    await (0, database_1.connectDB)();
});
afterAll(async () => {
    await (0, database_1.disconnectDB)();
});
afterEach(async () => {
    // Clean up test data after each test
    const db = (0, database_1.getDB)();
    await db.collection('stockMovementLogs').deleteMany({});
    await db.collection('usedMaterialsView').deleteMany({});
    await db.collection('remainingMaterialsView').deleteMany({});
    await db.collection('mainStock').deleteMany({});
    await db.collection('siteRecords').deleteMany({});
    await db.collection('siteAssignments').deleteMany({});
    await db.collection('sites').deleteMany({});
    await db.collection('users').deleteMany({});
});
//# sourceMappingURL=setup.js.map