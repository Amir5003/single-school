const ApiError = require('../utils/ApiError');
const policy = require('../services/subscription/policy');

/**
 * Subscription access middleware factory.
 *
 * Use AFTER `authenticate → schoolScope → authorize(...)`. Reads the
 * current subscription state from `req.school.subscription` and the role
 * from `req.user.role`, evaluates the matrix, and either calls next() or
 * returns HTTP 402 with a machine-readable `code` so the frontend can
 * branch deterministically.
 *
 * @param {'read'|'admin_write'|'teacher_write'|'student_onboarding'|'billing'} op
 */
const checkSubscriptionAccess = (op) => (req, _res, next) => {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required'));
  }
  if (req.user.role === 'super-admin') return next();

  if (!req.school) {
    return next(new ApiError(403, 'No school context'));
  }

  // Treat a school without a subscription subdoc as legacy → allow. The
  // lifecycle migration backfills it on its next cron pass.
  const subscription = req.school.subscription;
  if (!subscription || !subscription.status) {
    return next();
  }

  const decision = policy.evaluate({
    status: subscription.status,
    role: req.user.role,
    op,
    subscription,
  });

  if (decision.allow) return next();

  const err = new ApiError(402, decision.message || 'Payment required');
  err.code = decision.code;
  err.subscription = {
    status: subscription.status,
    activeStudentCount: subscription.activeStudentCount,
    maxTrialStudents: subscription.maxTrialStudents,
    trialEndsAt: subscription.trialEndsAt,
    graceEndsAt: subscription.graceEndsAt,
  };
  return next(err);
};

module.exports = checkSubscriptionAccess;
