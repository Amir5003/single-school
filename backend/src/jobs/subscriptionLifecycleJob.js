const cron = require('node-cron');
const School = require('../models/School.model');
const subscriptionLifecycle = require('../services/subscription/lifecycle.service');
const studentCount = require('../services/subscription/studentCount.service');
const logger = require('../utils/logger');

/**
 * subscriptionLifecycleJob
 *
 * Runs daily at 02:00 server time. Performs:
 *   1. Backfills the `subscription` subdoc on any legacy school that pre-dates
 *      this feature (treated as active for 365 days).
 *   2. active → expired         (subscriptionEndsAt < now)
 *   3. grace_period → expired   (graceEndsAt < now)
 *   4. trial/trial_limit_reached → grace_period (trialEndsAt < now)
 *   5. Self-heals the cached `activeStudentCount` by recomputing it for every
 *      school. Auto-flips trial ↔ trial_limit_reached on drift.
 *
 * Idempotent: each transition is guarded by the current status, so duplicate
 * runs on the same day produce no new events.
 */
const runOnce = async () => {
  logger.info('[subscriptionLifecycleJob] starting');

  // 1) Legacy backfill
  const legacy = await School.find({ 'subscription.status': { $exists: false } }).lean();
  for (const s of legacy) {
    try {
      await subscriptionLifecycle.migrateLegacyIfNeeded(s);
    } catch (err) {
      logger.error(`[subscriptionLifecycleJob] legacy migrate ${s._id}: ${err.message}`);
    }
  }

  // 2-4) Lifecycle transitions
  const transitions = await subscriptionLifecycle.runDailyLifecycleTick();
  logger.info(
    `[subscriptionLifecycleJob] transitions: active→expired=${transitions.activeToExpired}, grace→expired=${transitions.toExpired}, trial→grace=${transitions.toGrace}`
  );

  // 5) Self-heal cached student count
  const allSchools = await School.find({}, '_id').lean();
  for (const s of allSchools) {
    try {
      await studentCount.updateCachedCount(s._id, { silent: true });
    } catch (err) {
      logger.error(
        `[subscriptionLifecycleJob] count refresh ${s._id}: ${err.message}`
      );
    }
  }

  logger.info('[subscriptionLifecycleJob] done');
};

const start = () => {
  // Daily 02:00 server time
  cron.schedule('0 2 * * *', () => {
    runOnce().catch((err) =>
      logger.error(`[subscriptionLifecycleJob] crashed: ${err.message}`)
    );
  });

  // Run once at boot so a freshly started server doesn't sit on stale state
  // until the next cron tick.
  if (process.env.NODE_ENV !== 'test') {
    setTimeout(() => {
      runOnce().catch((err) =>
        logger.error(`[subscriptionLifecycleJob] boot tick crashed: ${err.message}`)
      );
    }, 5000);
  }

  logger.info('[subscriptionLifecycleJob] scheduled — runs daily at 02:00');
};

module.exports = { start, runOnce };
