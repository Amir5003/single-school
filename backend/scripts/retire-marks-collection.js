/**
 * Migration: 009-retire-marks-collection
 *
 * Spec 009 replaces the flat `Marks` collection with Assessment +
 * AssessmentScore. The old model, service, controller and routes are gone, so
 * the `marks` collection is now orphaned data that nothing reads.
 *
 * Dropping it also removes its indexes, which matters: Mongoose never drops
 * indexes for a model it no longer defines, so they would otherwise linger
 * forever on a collection with no code behind it.
 *
 * Coursework recorded under the old flat model is NOT migrated. It could not be
 * migrated faithfully — the old rows have no title, no conducted date and no
 * recorded author, which are precisely the fields spec 009 exists to add, and
 * the old unique key means only the most recent mark per type per subject
 * survived anyway. The data is disposable pre-launch.
 *
 * Usage:
 *   node scripts/retire-marks-collection.js            # report only
 *   node scripts/retire-marks-collection.js --confirm  # actually drop
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MIGRATION_ID = '009-retire-marks-collection';
const COLLECTION = 'marks';

async function run() {
  const confirmed = process.argv.includes('--confirm');

  // db.js reads MONGO_URI; migrate-to-multitenant.js reads MONGODB_URI.
  // Never fall back to a default — silently connecting to localhost would make
  // this appear to succeed while doing nothing.
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('ERROR: set MONGO_URI (or MONGODB_URI) before running this script.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  console.log(`[${MIGRATION_ID}] connected to ${mongoose.connection.name}`);

  const exists = await db.listCollections({ name: COLLECTION }).hasNext();
  if (!exists) {
    console.log(`[${MIGRATION_ID}] collection "${COLLECTION}" does not exist — nothing to do.`);
    await mongoose.disconnect();
    return;
  }

  const count = await db.collection(COLLECTION).countDocuments();
  console.log(`[${MIGRATION_ID}] "${COLLECTION}" holds ${count} document(s).`);

  if (!confirmed) {
    console.log(
      `[${MIGRATION_ID}] DRY RUN — nothing dropped.\n` +
        `  These rows are unreachable: no model, service or route reads them.\n` +
        `  Re-run with --confirm to drop the collection permanently.`
    );
    await mongoose.disconnect();
    return;
  }

  await db.collection(COLLECTION).drop();
  await db
    .collection('_migrations')
    .insertOne({ _id: MIGRATION_ID, appliedAt: new Date(), droppedDocuments: count });
  console.log(`[${MIGRATION_ID}] dropped "${COLLECTION}" (${count} document(s) + all indexes).`);

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(`[${MIGRATION_ID}] FAILED:`, err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
