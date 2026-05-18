/**
 * Migration: 001-add-school-id
 *
 * Idempotent migration that adds `schoolId` to all existing documents
 * in the 9 tenant-scoped collections using a seed School document.
 *
 * Usage:
 *   SEED_SCHOOL_NAME="My School" SEED_SCHOOL_SLUG="my-school" \
 *   MONGODB_URI="mongodb://..." node scripts/migrate-to-multitenant.js
 *
 * Environment variables:
 *   MONGODB_URI          — MongoDB connection string (required)
 *   SEED_SCHOOL_NAME     — Name for the seed school (default: "Default School")
 *   SEED_SCHOOL_SLUG     — Slug for the seed school (default: "default-school")
 *   SEED_SCHOOL_ID       — Optional: fixed ObjectId to use for the seed school
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MIGRATION_ID = '001-add-school-id';

const COLLECTIONS = [
  'users',
  'students',
  'teachers',
  'classes',
  'classteachers',
  'attendances',
  'marks',
  'timetables',
  'announcements',
];

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('ERROR: MONGODB_URI is required');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  console.log('Connected to MongoDB');

  // ── Check if already migrated ──────────────────────────────────────────────
  const migrations = db.collection('_migrations');
  const already = await migrations.findOne({ _id: MIGRATION_ID });
  if (already) {
    console.log(`Migration "${MIGRATION_ID}" already applied. Skipping.`);
    await mongoose.disconnect();
    return;
  }

  // ── Create (or reuse) seed school ─────────────────────────────────────────
  const schoolName = process.env.SEED_SCHOOL_NAME || 'Default School';
  const schoolSlug = process.env.SEED_SCHOOL_SLUG || 'default-school';
  const schools = db.collection('schools');

  let seedSchool = await schools.findOne({ slug: schoolSlug });
  if (!seedSchool) {
    const fixedId = process.env.SEED_SCHOOL_ID
      ? new mongoose.Types.ObjectId(process.env.SEED_SCHOOL_ID)
      : new mongoose.Types.ObjectId();

    await schools.insertOne({
      _id: fixedId,
      name: schoolName,
      slug: schoolSlug,
      slugLockedAt: new Date(),
      plan: 'free',
      isActive: true,
      branding: {
        logoUrl: null,
        primaryColor: '#1a73e8',
        secondaryColor: '#fbbc04',
        tagline: null,
        address: null,
        contactNumber: null,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    seedSchool = await schools.findOne({ slug: schoolSlug });
    console.log(`Created seed school: "${schoolName}" (${schoolSlug}) — _id: ${seedSchool._id}`);
  } else {
    console.log(`Reusing existing school: "${seedSchool.name}" — _id: ${seedSchool._id}`);
  }

  const seedSchoolId = seedSchool._id;

  // ── Bulk-update all collections ────────────────────────────────────────────
  for (const col of COLLECTIONS) {
    const collection = db.collection(col);
    const result = await collection.updateMany(
      { schoolId: { $exists: false } },
      { $set: { schoolId: seedSchoolId } }
    );
    console.log(`  ${col}: updated ${result.modifiedCount} documents`);
  }

  // ── Recreate students enrollmentId index as compound ─────────────────────
  try {
    await db.collection('students').dropIndex('enrollmentId_1');
    console.log('  Dropped global enrollmentId unique index on students');
  } catch {
    // Index may not exist (already compound or never created)
  }

  // ── Record migration ───────────────────────────────────────────────────────
  await migrations.insertOne({
    _id: MIGRATION_ID,
    appliedAt: new Date(),
    seedSchoolId,
  });

  console.log(`\nMigration "${MIGRATION_ID}" completed successfully.`);
  console.log(`Seed school ID: ${seedSchoolId}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exitCode = 1;
  mongoose.disconnect();
});
