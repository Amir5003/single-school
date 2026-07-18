const School = require('../../models/School.model');
const ApiError = require('../../utils/ApiError');
const logger = require('../../utils/logger');
const eventService = require('./event.service');
const pricingService = require('./pricing.service');

const DAY_MS = 24 * 60 * 60 * 1000;
const CYCLE_DURATION_DAYS = { monthly: 30, annual: 365 };
const PAID_CYCLE_DAYS = CYCLE_DURATION_DAYS.monthly;

// Allowed state transitions. Any transition not listed here throws.
const ALLOWED_TRANSITIONS = {
  trial: ['trial_limit_reached', 'grace_period', 'active', 'cancelled'],
  trial_limit_reached: ['trial', 'grace_period', 'active', 'cancelled'],
  grace_period: ['active', 'expired', 'cancelled'],
  active: ['expired', 'cancelled'],
  expired: ['active', 'cancelled'],
  cancelled: ['active'],
};

const EVENT_FOR_STATUS = {
  trial: 'trial_started',
  trial_limit_reached: 'trial_limit_reached',
  grace_period: 'grace_started',
  active: 'subscription_activated',
  expired: 'subscription_expired',
  cancelled: 'subscription_cancelled',
};

/**
 * Initialise a brand-new school's subscription. Called from onboarding inside
 * the transaction.
 *
 * @param {string|ObjectId} schoolId
 * @param {object} [opts]
 * @param {ClientSession} [opts.session]
 */
const initializeForNewSchool = async (schoolId, { session } = {}) => {
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + School.TRIAL_DURATION_DAYS * DAY_MS);

  await School.findByIdAndUpdate(
    schoolId,
    {
      $set: {
        'subscription.status': 'trial',
        'subscription.planType': 'starter',
        'subscription.trialStartedAt': now,
        'subscription.trialEndsAt': trialEndsAt,
        'subscription.graceStartedAt': null,
        'subscription.graceEndsAt': null,
        'subscription.subscriptionStartedAt': null,
        'subscription.subscriptionEndsAt': null,
        'subscription.activeStudentCount': 0,
        'subscription.maxTrialStudents': School.DEFAULT_MAX_TRIAL_STUDENTS,
        'subscription.basePrice': 0,
        'subscription.perStudentPrice': 0,
        'subscription.lastPaymentAt': null,
        'subscription.lastPaymentId': null,
        'subscription.nextBillingDate': null,
        'subscription.paymentProvider': null,
      },
    },
    { session }
  );

  await eventService.logEvent(
    schoolId,
    'trial_started',
    {
      trialEndsAt,
      maxTrialStudents: School.DEFAULT_MAX_TRIAL_STUDENTS,
    },
    { session }
  );
};

/**
 * Migrate an existing school that pre-dates this feature into `active` with a
 * 365-day pre-paid window so they keep working.
 */
const migrateLegacyIfNeeded = async (school) => {
  if (!school || !school._id) return null;
  if (school.subscription && school.subscription.status) return null;

  const now = new Date();
  const subscriptionEndsAt = new Date(now.getTime() + 365 * DAY_MS);
  const planAmount = pricingService.calculateAmount({
    planType: 'standard',
    billingCycle: 'annual',
  });

  await School.findByIdAndUpdate(school._id, {
    $set: {
      'subscription.status': 'active',
      'subscription.planType': 'standard',
      'subscription.billingCycle': 'annual',
      'subscription.trialStartedAt': school.createdAt || now,
      'subscription.trialEndsAt': new Date(
        (school.createdAt ? school.createdAt.getTime() : now.getTime()) +
          School.TRIAL_DURATION_DAYS * DAY_MS
      ),
      'subscription.subscriptionStartedAt': now,
      'subscription.subscriptionEndsAt': subscriptionEndsAt,
      'subscription.nextBillingDate': subscriptionEndsAt,
      'subscription.basePrice': planAmount,
      'subscription.perStudentPrice': 0,
      'subscription.maxTrialStudents': School.DEFAULT_MAX_TRIAL_STUDENTS,
    },
  });

  await eventService.logEvent(school._id, 'migrated', {
    previousStatus: null,
    newStatus: 'active',
    subscriptionEndsAt,
  });

  return true;
};

/**
 * Core guarded transition. Validates the move is legal, applies the right
 * field updates, writes an audit event.
 *
 * @param {object} school                The current school document (must
 *                                       have _id + subscription).
 * @param {string} nextStatus            One of SUBSCRIPTION_STATUSES.
 * @param {object} [metadata]            Extra event metadata + transition
 *                                       overrides (planType, durationDays,
 *                                       payment fields, actorUserId, …).
 * @returns {Promise<object>}            The updated school document (lean).
 */
const transitionTo = async (school, nextStatus, metadata = {}) => {
  if (!school || !school._id || !school.subscription) {
    throw new ApiError(500, 'School subscription is not initialised');
  }

  const currentStatus = school.subscription.status;
  if (currentStatus === nextStatus) {
    // Idempotent no-op — still update fields if the caller passed any
    // payment metadata; but skip the event log to keep replays quiet.
    return school;
  }

  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw new ApiError(
      409,
      `Illegal subscription transition: ${currentStatus} → ${nextStatus}`
    );
  }

  const update = { 'subscription.status': nextStatus };
  const now = new Date();

  switch (nextStatus) {
    case 'grace_period': {
      const graceStartedAt = school.subscription.trialEndsAt || now;
      const graceEndsAt = new Date(
        graceStartedAt.getTime() + School.GRACE_DURATION_DAYS * DAY_MS
      );
      update['subscription.graceStartedAt'] = graceStartedAt;
      update['subscription.graceEndsAt'] = graceEndsAt;
      metadata.graceStartedAt = graceStartedAt;
      metadata.graceEndsAt = graceEndsAt;
      break;
    }

    case 'active': {
      const planType = metadata.planType || school.subscription.planType || 'standard';
      const billingCycle =
        metadata.billingCycle || school.subscription.billingCycle || 'monthly';
      const plan = pricingService.getPlan(planType);
      const durationDays =
        metadata.durationDays || CYCLE_DURATION_DAYS[billingCycle] || PAID_CYCLE_DAYS;
      const subscriptionEndsAt = new Date(now.getTime() + durationDays * DAY_MS);
      const planAmount = pricingService.calculateAmount({ planType, billingCycle });

      update['subscription.planType'] = planType;
      update['subscription.billingCycle'] = billingCycle;
      update['subscription.subscriptionStartedAt'] = now;
      update['subscription.subscriptionEndsAt'] = subscriptionEndsAt;
      update['subscription.nextBillingDate'] = subscriptionEndsAt;
      update['subscription.basePrice'] = planAmount;
      update['subscription.perStudentPrice'] = 0;
      // Clear any scheduled change — the user just paid for a fresh window.
      update['subscription.scheduledChange'] = null;
      // Payment metadata
      if (metadata.providerPaymentId) {
        update['subscription.lastPaymentAt'] = now;
        update['subscription.lastPaymentId'] = metadata.providerPaymentId;
      }
      if (metadata.paymentProvider) {
        update['subscription.paymentProvider'] = metadata.paymentProvider;
      }
      metadata.subscriptionEndsAt = subscriptionEndsAt;
      metadata.planType = planType;
      metadata.billingCycle = billingCycle;
      metadata.amount = planAmount;
      break;
    }

    case 'expired': {
      // No new fields — `expired` is just a flag. Optionally clear nextBillingDate.
      update['subscription.nextBillingDate'] = null;
      break;
    }

    case 'cancelled': {
      update['subscription.nextBillingDate'] = null;
      break;
    }

    case 'trial':
    case 'trial_limit_reached':
    default:
      break;
  }

  metadata.previousStatus = currentStatus;
  metadata.newStatus = nextStatus;

  const updated = await School.findByIdAndUpdate(
    school._id,
    { $set: update },
    { new: true, lean: true }
  );

  await eventService.logEvent(
    school._id,
    EVENT_FOR_STATUS[nextStatus] || 'plan_changed',
    metadata
  );

  logger.info(
    `[subscription.lifecycle] School ${school._id}: ${currentStatus} → ${nextStatus}`
  );

  return updated;
};

/**
 * Persist a scheduled plan/cycle change that takes effect at the end of the
 * current paid window. Used for downgrades and cycle-downgrades.
 *
 * @param {object} school
 * @param {{ planType: string, billingCycle: string, reason?: string }} change
 * @returns {Promise<object>} updated school (lean)
 */
const scheduleChange = async (school, { planType, billingCycle, reason = null }) => {
  if (!school || !school._id) {
    throw new ApiError(500, 'School subscription is not initialised');
  }
  const applyAt = school.subscription?.subscriptionEndsAt || new Date();
  const scheduledChange = {
    planType,
    billingCycle,
    applyAt,
    scheduledAt: new Date(),
    reason,
  };

  const updated = await School.findByIdAndUpdate(
    school._id,
    { $set: { 'subscription.scheduledChange': scheduledChange } },
    { new: true, lean: true }
  );

  await eventService.logEvent(school._id, 'plan_changed', {
    type: 'scheduled',
    planType,
    billingCycle,
    applyAt,
    reason,
  });

  logger.info(
    `[subscription.lifecycle] Scheduled change for ${school._id}: → ${planType}/${billingCycle} at ${applyAt.toISOString()}`
  );

  return updated;
};

/**
 * Cancel any pending scheduled change. Returns the updated subscription.
 */
const cancelScheduledChange = async (school) => {
  if (!school || !school._id) return school;
  if (!school.subscription?.scheduledChange) return school;
  const updated = await School.findByIdAndUpdate(
    school._id,
    { $set: { 'subscription.scheduledChange': null } },
    { new: true, lean: true }
  );
  await eventService.logEvent(school._id, 'plan_changed', {
    type: 'scheduled_cancelled',
  });
  return updated;
};

/**
 * If an active school's `subscriptionEndsAt` is past AND a `scheduledChange`
 * is pending, apply it as a fresh `active` window using the new plan/cycle.
 * No payment — this is the previously-purchased downgrade taking effect.
 *
 * Returns true when the school was advanced via a scheduled change (caller
 * should skip the expired transition for this school).
 */
const applyScheduledChangeIfDue = async (school) => {
  const sub = school.subscription;
  if (!sub || sub.status !== 'active') return false;
  if (!sub.scheduledChange) return false;
  if (!sub.subscriptionEndsAt || new Date(sub.subscriptionEndsAt) > new Date()) {
    return false;
  }

  try {
    // Effectively renew the school into the new plan/cycle without payment.
    // Use a synthetic transition by allowing active → active via internal path.
    const planType = sub.scheduledChange.planType;
    const billingCycle = sub.scheduledChange.billingCycle;
    const plan = pricingService.getPlan(planType);
    const durationDays = CYCLE_DURATION_DAYS[billingCycle] || PAID_CYCLE_DAYS;
    const now = new Date();
    const newEndsAt = new Date(now.getTime() + durationDays * DAY_MS);
    const planAmount = pricingService.calculateAmount({ planType, billingCycle });

    await School.findByIdAndUpdate(school._id, {
      $set: {
        'subscription.planType': planType,
        'subscription.billingCycle': billingCycle,
        'subscription.subscriptionStartedAt': now,
        'subscription.subscriptionEndsAt': newEndsAt,
        'subscription.nextBillingDate': newEndsAt,
        'subscription.basePrice': planAmount,
        'subscription.perStudentPrice': 0,
        'subscription.scheduledChange': null,
      },
    });

    await eventService.logEvent(school._id, 'plan_changed', {
      type: 'scheduled_applied',
      previousPlan: sub.planType,
      previousCycle: sub.billingCycle,
      newPlan: planType,
      newCycle: billingCycle,
      newEndsAt,
    });

    logger.info(
      `[subscription.lifecycle] Applied scheduled change for ${school._id}: ${sub.planType}/${sub.billingCycle} → ${planType}/${billingCycle}`
    );
    return true;
  } catch (err) {
    logger.error(
      `[subscription.lifecycle] applyScheduledChange failed for ${school._id}: ${err.message}`
    );
    return false;
  }
};

/**
 * Cron entrypoint — scan for due transitions and apply them. Idempotent.
 *
 * @returns {Promise<{ toGrace: number, toExpired: number, activeToExpired: number, scheduledApplied: number }>}
 */
const runDailyLifecycleTick = async () => {
  const now = new Date();

  // 1) active → expired  (and apply scheduled changes first when present)
  const activeExpiredCandidates = await School.find({
    'subscription.status': 'active',
    'subscription.subscriptionEndsAt': { $lt: now },
  }).lean();

  let activeToExpired = 0;
  let scheduledApplied = 0;
  for (const school of activeExpiredCandidates) {
    try {
      const applied = await applyScheduledChangeIfDue(school);
      if (applied) {
        scheduledApplied += 1;
        continue;
      }
      await transitionTo(school, 'expired', { reason: 'subscription_window_ended' });
      activeToExpired += 1;
    } catch (err) {
      logger.error(
        `[subscription.lifecycle] active→expired failed for ${school._id}: ${err.message}`
      );
    }
  }

  // 2) grace_period → expired
  const graceExpiredCandidates = await School.find({
    'subscription.status': 'grace_period',
    'subscription.graceEndsAt': { $lt: now },
  }).lean();

  let toExpired = 0;
  for (const school of graceExpiredCandidates) {
    try {
      await transitionTo(school, 'expired', { reason: 'grace_window_ended' });
      toExpired += 1;
    } catch (err) {
      logger.error(
        `[subscription.lifecycle] grace→expired failed for ${school._id}: ${err.message}`
      );
    }
  }

  // 3) trial / trial_limit_reached → grace_period
  const trialExpiredCandidates = await School.find({
    'subscription.status': { $in: ['trial', 'trial_limit_reached'] },
    'subscription.trialEndsAt': { $lt: now },
  }).lean();

  let toGrace = 0;
  for (const school of trialExpiredCandidates) {
    try {
      await transitionTo(school, 'grace_period', { reason: 'trial_window_ended' });
      toGrace += 1;
    } catch (err) {
      logger.error(
        `[subscription.lifecycle] trial→grace failed for ${school._id}: ${err.message}`
      );
    }
  }

  return { activeToExpired, toExpired, toGrace, scheduledApplied };
};

module.exports = {
  ALLOWED_TRANSITIONS,
  initializeForNewSchool,
  migrateLegacyIfNeeded,
  transitionTo,
  scheduleChange,
  cancelScheduledChange,
  applyScheduledChangeIfDue,
  runDailyLifecycleTick,
};
