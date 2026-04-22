import { connectDB, disconnectDB, getDB } from '../config/database';

beforeAll(async () => {
  // Connect to test database
  await connectDB();
});

afterAll(async () => {
  await disconnectDB();
});

afterEach(async () => {
  // Clean up test data after each test
  const db = getDB();
  await db.collection('stockMovementLogs').deleteMany({});
  await db.collection('usedMaterialsView').deleteMany({});
  await db.collection('remainingMaterialsView').deleteMany({});
  await db.collection('mainStock').deleteMany({});
  await db.collection('siteRecords').deleteMany({});
  await db.collection('siteAssignments').deleteMany({});
  await db.collection('sites').deleteMany({});
  await db.collection('users').deleteMany({});
});
