const School = require('../models/School.model');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const subscriptionService = require('../services/subscription');
const changeService = require('../services/subscription/change.service');

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Build the frontend-friendly subscription summary that every billing view
 * reads from. Keep the shape stable — frontend tests pin to it.
 */
const buildSummary = (school) => {
  const sub = school?.subscription || {};
  const now = Date.now();

  const daysUntil = (date) =>
    date ? Math.max(0, Math.ceil((new Date(date).getTime() - now) / DAY_MS)) : null;

  const planType = sub.planType || 'starter';
  const billingCycle = sub.billingCycle || 'monthly';
  const monthlyPrice = subscriptionService.pricing.calculateAmount({
    planType,
    billingCycle: 'monthly',
  });
  const currentCycleAmount = subscriptionService.pricing.calculateAmount({
    planType,
    billingCycle,
  });
  const currentCycleListAmount = subscriptionService.pricing.calculateListAmount({
    planType,
    billingCycle,
  });
  let studentCap = null;
  try {
    studentCap = subscriptionService.pricing.getStudentCap(planType);
  } catch {
    studentCap = null;
  }

  const features = subscriptionService.pricing.getEntitledFeatures(sub);

  return {
    schoolId: school._id,
    status: sub.status,
    planType,
    billingCycle,
    features,
    trialStartedAt: sub.trialStartedAt,
    trialEndsAt: sub.trialEndsAt,
    graceStartedAt: sub.graceStartedAt,
    graceEndsAt: sub.graceEndsAt,
    subscriptionStartedAt: sub.subscriptionStartedAt,
    subscriptionEndsAt: sub.subscriptionEndsAt,
    activeStudentCount: sub.activeStudentCount || 0,
    maxTrialStudents: sub.maxTrialStudents || School.DEFAULT_MAX_TRIAL_STUDENTS,
    studentCap,
    monthlyPrice,
    currentCycleAmount,
    currentCycleListAmount,
    basePrice: sub.basePrice || 0,
    perStudentPrice: 0,
    lastPaymentAt: sub.lastPaymentAt,
    nextBillingDate: sub.nextBillingDate,
    daysUntilTrialEnd: daysUntil(sub.trialEndsAt),
    daysUntilGraceEnd: daysUntil(sub.graceEndsAt),
    daysUntilSubscriptionEnd: daysUntil(sub.subscriptionEndsAt),
    paymentProvider: sub.paymentProvider,
    scheduledChange: sub.scheduledChange || null,
  };
};

/**
 * GET /api/v1/subscription
 */
const getSubscription = async (req, res, next) => {
  try {
    const school = await School.findById(req.school._id).lean();
    if (!school) throw new ApiError(404, 'School not found');

    return res.json(
      new ApiResponse(
        200,
        {
          subscription: buildSummary(school),
          plans: subscriptionService.pricing.previewPricing(),
        },
        'Subscription retrieved'
      )
    );
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/v1/subscription/pricing
 */
const getPricing = async (req, res, next) => {
  try {
    return res.json(
      new ApiResponse(
        200,
        {
          plans: subscriptionService.pricing.previewPricing(),
        },
        'Pricing retrieved'
      )
    );
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/v1/subscription/upgrade
 *
 * Evaluates whether the requested (planType, billingCycle) is an upgrade,
 * downgrade or same-plan re-pay. Same-plan and downgrades never charge —
 * they either error out or schedule a change for the next renewal.
 */
const createUpgradeOrder = async (req, res, next) => {
  try {
    const { planType, billingCycle = 'monthly' } = req.body;
    const school = await School.findById(req.school._id).lean();
    if (!school) throw new ApiError(404, 'School not found');

    const decision = changeService.evaluate({ school, targetPlan: planType, targetCycle: billingCycle });

    // Block same-plan re-pay and other invalid-immediate cases. Frontend uses
    // `code` to branch into either an inline message or the schedule-downgrade
    // confirmation flow.
    if (!decision.allowImmediate) {
      const err = new ApiError(409, decision.message || 'Plan change not allowed');
      err.code = decision.code;
      err.shouldSchedule = decision.shouldSchedule || false;
      err.changeType = decision.type;
      throw err;
    }

    const order = await subscriptionService.paymentProvider.createOrder({
      schoolId: school._id.toString(),
      amount: decision.amount,
      currency: 'INR',
      notes: { planType, billingCycle, changeType: decision.type },
    });

    return res.json(
      new ApiResponse(
        200,
        {
          order: {
            ...order,
            planType,
            billingCycle,
            changeType: decision.type,
            isLive: subscriptionService.paymentProvider.isLive(),
          },
        },
        'Order created'
      )
    );
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/v1/subscription/verify-payment
 */
const verifyPayment = async (req, res, next) => {
  try {
    const { orderId, providerPaymentId, providerSignature, planType, billingCycle } = req.body;

    const verification = await subscriptionService.paymentProvider.verifyPayment({
      orderId,
      providerPaymentId,
      providerSignature,
    });

    if (!verification.verified) {
      throw new ApiError(400, 'Payment signature verification failed');
    }

    const alreadyProcessed = await subscriptionService.event.hasPaymentBeenProcessed(
      providerPaymentId
    );

    const school = await School.findById(req.school._id).lean();

    if (alreadyProcessed) {
      const refreshed = await School.findById(req.school._id).lean();
      return res.json(
        new ApiResponse(
          200,
          { subscription: buildSummary(refreshed) },
          'Payment already processed'
        )
      );
    }

    const effectivePlan = planType || school.subscription?.planType || 'standard';
    const effectiveCycle = billingCycle || school.subscription?.billingCycle || 'monthly';

    await subscriptionService.event.logEvent(school._id, 'payment_success', {
      providerOrderId: orderId,
      providerPaymentId,
      planType: effectivePlan,
      billingCycle: effectiveCycle,
      amount: subscriptionService.pricing.calculateAmount({
        planType: effectivePlan,
        billingCycle: effectiveCycle,
      }),
      currency: 'INR',
      source: 'client_callback',
    });

    const updated = await subscriptionService.lifecycle.transitionTo(school, 'active', {
      planType: effectivePlan,
      billingCycle: effectiveCycle,
      providerPaymentId,
      paymentProvider: subscriptionService.paymentProvider.name,
      source: 'client_callback',
    });

    return res.json(
      new ApiResponse(200, { subscription: buildSummary(updated) }, 'Payment verified')
    );
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/v1/subscription/schedule-downgrade
 *
 * Records a downgrade (or cycle-downgrade) to apply at the end of the
 * current paid window. No payment is taken.
 */
const scheduleDowngrade = async (req, res, next) => {
  try {
    const { planType, billingCycle = 'monthly' } = req.body;
    const school = await School.findById(req.school._id).lean();
    if (!school) throw new ApiError(404, 'School not found');

    const decision = changeService.evaluate({ school, targetPlan: planType, targetCycle: billingCycle });
    if (!decision.shouldSchedule) {
      const err = new ApiError(
        409,
        decision.message || 'Only downgrades can be scheduled. Use /subscription/upgrade for upgrades.'
      );
      err.code = decision.code || 'NOT_A_DOWNGRADE';
      throw err;
    }

    const updated = await subscriptionService.lifecycle.scheduleChange(school, {
      planType,
      billingCycle,
      reason: req.body?.reason || decision.code,
    });

    return res.json(
      new ApiResponse(
        200,
        { subscription: buildSummary(updated) },
        decision.message || 'Downgrade scheduled at next renewal'
      )
    );
  } catch (err) {
    return next(err);
  }
};

/**
 * DELETE /api/v1/subscription/scheduled-change
 *
 * Cancel a pending scheduled downgrade.
 */
const cancelScheduledChange = async (req, res, next) => {
  try {
    const school = await School.findById(req.school._id).lean();
    if (!school) throw new ApiError(404, 'School not found');
    const updated = await subscriptionService.lifecycle.cancelScheduledChange(school);
    return res.json(
      new ApiResponse(
        200,
        { subscription: buildSummary(updated) },
        'Scheduled change cancelled'
      )
    );
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/v1/subscription/history
 */
const getHistory = async (req, res, next) => {
  try {
    const events = await subscriptionService.event.listForSchool(req.school._id, 50);
    return res.json(new ApiResponse(200, { events }, 'Subscription history retrieved'));
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/v1/subscription/cancel
 */
const cancelSubscription = async (req, res, next) => {
  try {
    const school = await School.findById(req.school._id).lean();
    if (!school) throw new ApiError(404, 'School not found');

    const updated = await subscriptionService.lifecycle.transitionTo(school, 'cancelled', {
      actorUserId: req.user._id,
      reason: req.body?.reason || null,
    });

    return res.json(
      new ApiResponse(200, { subscription: buildSummary(updated) }, 'Subscription cancelled')
    );
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  buildSummary,
  getSubscription,
  getPricing,
  createUpgradeOrder,
  verifyPayment,
  scheduleDowngrade,
  cancelScheduledChange,
  getHistory,
  cancelSubscription,
};
