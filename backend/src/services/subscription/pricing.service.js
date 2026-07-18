/**
 * Pricing catalogue + helpers.
 *
 * Flat tier pricing — each plan has a fixed monthly price, a hard student
 * cap, and a list of enabled `features`. Annual billing applies a 15%
 * discount on `monthlyPrice × 12`.
 *
 * Keep this file pure: no DB. Config side-channels are limited to env: the
 * `PREMIUM_COMING_SOON` flag (read live so ops can flip premium off) and the
 * validated `PRICING_PROMO_PCT` global promo from config/env.js.
 *
 * Each plan carries a `listMonthlyPrice` (the original / "was" price shown
 * struck-through) alongside `monthlyPrice` (the price actually charged). When
 * the two differ — or a global promo is active — the UI renders the discount.
 */

const env = require('../../config/env');

const ANNUAL_DISCOUNT_PCT = 0.15;
const UNLIMITED = Number.POSITIVE_INFINITY;

// Centralised feature catalogue. Use these constants everywhere — never
// hard-code feature strings inside controllers or middleware.
const FEATURES = Object.freeze({
  ATTENDANCE: 'attendance',
  FEES: 'fees',
  HOMEWORK: 'homework',
  ANNOUNCEMENTS: 'announcements',
  EXAMS_RESULTS: 'exams_results',
  ANALYTICS: 'analytics',
  CHAT_SUPPORT: 'chat_support',
});

const CORE_FEATURES = [
  FEATURES.ATTENDANCE,
  FEATURES.FEES,
  FEATURES.HOMEWORK,
  FEATURES.ANNOUNCEMENTS,
];

const ALL_FEATURES = Object.values(FEATURES);

const PLANS = Object.freeze({
  starter: Object.freeze({
    id: 'starter',
    label: 'Starter',
    blurb: 'For new and small schools',
    monthlyPrice: 99,
    // Original / list price — shown struck-through when it exceeds monthlyPrice.
    listMonthlyPrice: 499,
    studentCap: 200,
    features: Object.freeze([...CORE_FEATURES]),
    highlights: [
      'Up to 200 students',
      'Core modules (attendance, fees, homework, announcements)',
      'Email support',
    ],
  }),
  standard: Object.freeze({
    id: 'standard',
    label: 'Standard',
    blurb: 'For growing schools',
    monthlyPrice: 299,
    listMonthlyPrice: 1499,
    studentCap: 1000,
    recommended: true,
    features: Object.freeze([
      ...CORE_FEATURES,
      FEATURES.EXAMS_RESULTS,
      FEATURES.CHAT_SUPPORT,
    ]),
    highlights: [
      'Up to 1,000 students',
      'Exam & results module',
      'Priority email + chat support',
    ],
  }),
  premium: Object.freeze({
    id: 'premium',
    label: 'Premium',
    blurb: 'For multi-campus institutions',
    monthlyPrice: 599,
    listMonthlyPrice: 2999,
    studentCap: UNLIMITED,
    features: Object.freeze([...ALL_FEATURES]),
    highlights: [
      'Unlimited students',
      'All modules + analytics',
      'Dedicated success manager',
    ],
  }),
});

// Plan ordering for upgrade/downgrade detection. Higher rank = bigger plan.
const PLAN_RANK = Object.freeze({ starter: 1, standard: 2, premium: 3 });

const BILLING_CYCLES = Object.freeze({
  monthly: { id: 'monthly', durationDays: 30, label: 'Monthly' },
  annual:  { id: 'annual',  durationDays: 365, label: 'Annual', discountPct: ANNUAL_DISCOUNT_PCT },
});

const isValidPlan = (planType) => Object.prototype.hasOwnProperty.call(PLANS, planType);
const isValidCycle = (cycle) => cycle === 'monthly' || cycle === 'annual';

const getPlan = (planType) => {
  if (!isValidPlan(planType)) {
    throw new Error(`Unknown planType: ${planType}`);
  }
  return PLANS[planType];
};

const getCycle = (cycle) => {
  if (!isValidCycle(cycle)) {
    throw new Error(`Unknown billing cycle: ${cycle}`);
  }
  return BILLING_CYCLES[cycle];
};

const listPlans = () => Object.values(PLANS);

const planRank = (planType) => PLAN_RANK[planType] || 0;

/**
 * @returns {boolean} true when `PREMIUM_COMING_SOON=true` is set in the env.
 */
const isPremiumComingSoon = () =>
  process.env.PREMIUM_COMING_SOON === 'true';

/**
 * Is `planType` selectable for purchase right now? Currently only the
 * `PREMIUM_COMING_SOON` flag can disable a plan — but keep this helper so
 * future feature flags hook into one place.
 */
const isPlanAvailable = (planType) => {
  if (planType === 'premium' && isPremiumComingSoon()) return false;
  return isValidPlan(planType);
};

/**
 * Does this plan grant access to the given feature?
 *
 * @param {string} planType
 * @param {string} feature  one of FEATURES.*
 */
const planHasFeature = (planType, feature) => {
  if (!isValidPlan(planType)) return false;
  return PLANS[planType].features.includes(feature);
};

/** Annualise a monthly price: 12 months with the annual discount applied. */
const annualise = (monthly) => Math.round(monthly * 12 * (1 - ANNUAL_DISCOUNT_PCT));

/**
 * Effective (charged) monthly price for a plan — the per-plan `monthlyPrice`
 * with the optional global `PRICING_PROMO_PCT` applied on top.
 */
const getEffectiveMonthlyPrice = (plan) => {
  const promo = env.PRICING_PROMO_PCT || 0;
  return promo > 0 ? Math.round(plan.monthlyPrice * (1 - promo)) : plan.monthlyPrice;
};

/** Original / list monthly price (falls back to the sale price when unset). */
const getListMonthlyPrice = (plan) =>
  typeof plan.listMonthlyPrice === 'number' ? plan.listMonthlyPrice : plan.monthlyPrice;

/**
 * Compute the chargeable amount for a plan + cycle (in INR rupees).
 *
 * monthly = effective monthly price (sale price, minus any global promo)
 * annual  = round(effectiveMonthly × 12 × (1 − ANNUAL_DISCOUNT_PCT))
 *
 * @param {{ planType: string, billingCycle?: 'monthly'|'annual' }} args
 * @returns {number}
 */
const calculateAmount = ({ planType, billingCycle = 'monthly' }) => {
  const plan = getPlan(planType);
  const monthly = getEffectiveMonthlyPrice(plan);
  return billingCycle === 'annual' ? annualise(monthly) : monthly;
};

/**
 * The "was" / original amount for a plan + cycle — used to render a
 * struck-through price. Equals `calculateAmount` when there is no discount.
 *
 * @param {{ planType: string, billingCycle?: 'monthly'|'annual' }} args
 * @returns {number}
 */
const calculateListAmount = ({ planType, billingCycle = 'monthly' }) => {
  const plan = getPlan(planType);
  const list = getListMonthlyPrice(plan);
  return billingCycle === 'annual' ? annualise(list) : list;
};

/**
 * Build a pricing preview for every plan at both cycles. Includes a
 * `comingSoon` flag so the frontend can render a disabled tile.
 */
const previewPricing = () =>
  listPlans().map((plan) => {
    const monthly = calculateAmount({ planType: plan.id, billingCycle: 'monthly' });
    const annual = calculateAmount({ planType: plan.id, billingCycle: 'annual' });
    const listMonthly = calculateListAmount({ planType: plan.id, billingCycle: 'monthly' });
    const listAnnual = calculateListAmount({ planType: plan.id, billingCycle: 'annual' });
    const annualSavings = monthly * 12 - annual;
    const annualEffectiveMonthly = Math.round(annual / 12);
    // Promo / standing discount vs the list price. Same fraction for both
    // cycles (they scale identically), so a single `discountPct` drives the UI.
    const hasDiscount = listMonthly > monthly;
    const discountPct = hasDiscount ? 1 - monthly / listMonthly : 0;
    const comingSoon = !isPlanAvailable(plan.id);
    return {
      ...plan,
      features: [...plan.features],
      studentCap: plan.studentCap === UNLIMITED ? null : plan.studentCap,
      studentCapDisplay:
        plan.studentCap === UNLIMITED ? 'Unlimited' : `Up to ${plan.studentCap}`,
      comingSoon,
      pricing: {
        monthly,
        annual,
        annualSavings,
        annualEffectiveMonthly,
        annualDiscountPct: ANNUAL_DISCOUNT_PCT,
        listMonthly,
        listAnnual,
        hasDiscount,
        discountPct,
      },
    };
  });

/**
 * @param {string} planType
 * @returns {number|null}  numeric cap or null for unlimited
 */
const getStudentCap = (planType) => {
  const cap = getPlan(planType).studentCap;
  return cap === UNLIMITED ? null : cap;
};

/**
 * Returns the feature list a school is currently entitled to.
 *
 * Rule:
 *   trial / trial_limit_reached / grace_period → ALL features
 *   active                                     → features of the active plan
 *   expired / cancelled                        → empty (read-only mode)
 *
 * @param {object} subscription   school.subscription subdoc (lean)
 * @returns {string[]}
 */
const getEntitledFeatures = (subscription) => {
  if (!subscription || !subscription.status) return [];
  const status = subscription.status;
  if (
    status === 'trial' ||
    status === 'trial_limit_reached' ||
    status === 'grace_period'
  ) {
    return [...ALL_FEATURES];
  }
  if (status === 'active' && subscription.planType && isValidPlan(subscription.planType)) {
    return [...PLANS[subscription.planType].features];
  }
  return [];
};

module.exports = {
  PLANS,
  PLAN_RANK,
  BILLING_CYCLES,
  FEATURES,
  ALL_FEATURES,
  ANNUAL_DISCOUNT_PCT,
  UNLIMITED,
  isValidPlan,
  isValidCycle,
  isPlanAvailable,
  isPremiumComingSoon,
  planHasFeature,
  getEntitledFeatures,
  getPlan,
  getCycle,
  getStudentCap,
  listPlans,
  planRank,
  calculateAmount,
  calculateListAmount,
  getEffectiveMonthlyPrice,
  previewPricing,
  // Backward-compat alias.
  calculateMonthlyAmount: ({ planType }) =>
    calculateAmount({ planType, billingCycle: 'monthly' }),
};
