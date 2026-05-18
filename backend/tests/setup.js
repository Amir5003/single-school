const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose');

// ── Set required env vars before any module in the test file is loaded ────────
// These top-level assignments run BEFORE each test file's require() calls.
process.env.PORT = process.env.PORT || '5001';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-jwt-secret-key-minimum-32-chars!!';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';
process.env.REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || 'test-refresh-secret-min-32-chars!!!';
process.env.NODE_ENV = 'test';
// MONGO_URI placeholder — overridden below once MongoMemoryReplSet starts
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://placeholder/test';

// MongoMemoryReplSet is required for multi-document transaction support (Phase 3+)
let mongoReplSet;

beforeAll(async () => {
  mongoReplSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = mongoReplSet.getUri();
  process.env.MONGO_URI = uri;
  await mongoose.connect(uri);
}, 60000); // allow extra time for replica set initialisation

afterAll(async () => {
  await mongoose.disconnect();
  await mongoReplSet.stop();
});

// Wipe every collection between tests for isolation
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});
