const ApiError = require('../utils/ApiError');
const pricing = require('../services/subscription/pricing.service');

/**
 * Feature-level access guard.
 *
 * Used to gate modules that aren't included in every plan (e.g. the
 * exam/result module is hidden on Starter). Runs AFTER
 * `authenticate → schoolScope → authorize(...)`.
 *
 * Rules:
 *   - super-admin              → always allowed
 *   - trial / grace            → all features allowed (the trial is meant to
 *                                let schools try every module)
 *   - active                   → checked against the plan's `features` list
 *   - expired / cancelled      → handled separately by checkSubscriptionAccess
 *                                on write routes. For read-only feature gating
 *                                we simply block here too, since the school
 *                                no longer has any plan entitlements.
 *
 * @param {string} feature  one of pricing.FEATURES values
 */
const checkFeatureAccess = (feature) => (req, _res, next) => {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required'));
  }
  if (req.user.role === 'super-admin') return next();
  if (!req.school) {
    return next(new ApiError(403, 'No school context'));
  }

  const subscription = req.school.subscription || {};
  const allowedFeatures = pricing.getEntitledFeatures(subscription);

  if (allowedFeatures.includes(feature)) {
    return next();
  }

  const err = new ApiError(
    402,
    `The ${feature.replace(/_/g, ' ')} module is not included in your current plan. Please upgrade to access it.`
  );
  err.code = 'FEATURE_NOT_AVAILABLE';
  err.feature = feature;
  err.subscription = {
    status: subscription.status,
    planType: subscription.planType,
  };
  return next(err);
};

module.exports = checkFeatureAccess;
