/**
 * Seed Super-Admin
 *
 * Creates a super-admin user using SUPER_ADMIN_EMAIL + SUPER_ADMIN_PASSWORD.
 * Idempotent via upsert — safe to run multiple times.
 *
 * Usage:
 *   SUPER_ADMIN_EMAIL="admin@platform.com" SUPER_ADMIN_PASSWORD="SecurePass1" \
 *   MONGODB_URI="mongodb://..." node scripts/seed-super-admin.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const DEFAULT_EMAIL = 'superadmin@platform.local';
const DEFAULT_PASSWORD = 'ChangeMe123!';
const BCRYPT_ROUNDS = 12;

async function run() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('ERROR: MONGO_URI is required');
    process.exit(1);
  }

  const email = process.env.SUPER_ADMIN_EMAIL || DEFAULT_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD || DEFAULT_PASSWORD;

  if (!process.env.SUPER_ADMIN_PASSWORD) {
    console.warn(
      '\n⚠️  WARNING: Using default super-admin password. Set SUPER_ADMIN_PASSWORD in production!\n'
    );
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const users = mongoose.connection.db.collection('users');
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const result = await users.updateOne(
    { email, role: 'super-admin' },
    {
      $set: {
        email,
        password: passwordHash,
        role: 'super-admin',
        schoolId: null,
        isActive: true,
        approvalStatus: 'approved',
        updatedAt: new Date(),
      },
      $setOnInsert: {
        name: 'Super Admin',
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );

  if (result.upsertedCount > 0) {
    console.log(`Super-admin created: ${email}`);
  } else {
    console.log(`Super-admin updated: ${email}`);
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Seeding failed:', err);
  process.exitCode = 1;
  mongoose.disconnect();
});
