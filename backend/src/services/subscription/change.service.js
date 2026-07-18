/**
 * Subscription change evaluator.
 *
 * Decides whether a request to switch to (`targetPlan`, `targetCycle`) is an
 * upgrade (allowed immediately), a downgrade (must be scheduled at renewal),
 * a same-plan re-pay (blocked while active), or simply the initial purchase.
 *
 * Pure: no IO. Returns a decision object the controller acts on.
 */

const pricing = require('./pricing.service');

const CYCLE_RANK = { monthly: 1, annual: 2 };

/**
 * @param {object} args
 * @param {object} args.school                      School document (lean)
 * @param {'starter'|'standard'|'premium'} args.targetPlan
 * @param {'monthly'|'annual'} args.targetCycle
 * @returns {{
 *   type: 'initial'|'upgrade'|'cycle_upgrade'|'downgrade'|'cycle_downgrade'|'same',
 *   allowImmediate: boolean,
 *   shouldSchedule: boolean,
 *   amount: number,
 *   code?: string,
 *   message?: string,
 * }}
 */
const evaluate = ({ school, targetPlan, targetCycle }) => {
  if (!pricing.isValidPlan(targetPlan)) {
    return {
      type: 'invalid',
      allowImmediate: false,
      shouldSchedule: false,
      amount: 0,
      code: 'INVALID_PLAN',
      message: `Unknown plan: ${targetPlan}`,
    };
  }
  if (!pricing.isValidCycle(targetCycle)) {
    return {
      type: 'invalid',
      allowImmediate: false,
      shouldSchedule: false,
      amount: 0,
      code: 'INVALID_BILLING_CYCLE',
      message: `Unknown billing cycle: ${targetCycle}`,
    };
  }

  // Plan-level availability gate (PREMIUM_COMING_SOON, etc.). Block both
  // upgrades and scheduled downgrades targeting an unavailable plan.
  if (!pricing.isPlanAvailable(targetPlan)) {
    return {
      type: 'unavailable',
      allowImmediate: false,
      shouldSchedule: false,
      amount: 0,
      code: 'PLAN_UNAVAILABLE',
      message: `The ${pricing.getPlan(targetPlan).label} plan is not available yet. Please try again later.`,
    };
  }

  const amount = pricing.calculateAmount({
    planType: targetPlan,
    billingCycle: targetCycle,
  });

  const sub = school.subscription || {};
  const status = sub.status;

  // Not active yet (trial / trial_limit / grace / expired / cancelled) →
  // any plan + cycle is a fresh purchase, paid immediately.
  if (status !== 'active') {
    return {
      type: 'initial',
      allowImmediate: true,
      shouldSchedule: false,
      amount,
    };
  }

  const currentPlan = sub.planType || 'starter';
  const currentCycle = sub.billingCycle || 'monthly';

  const currentRank = pricing.planRank(currentPlan);
  const newRank = pricing.planRank(targetPlan);

  // Same plan + same cycle → block.
  if (currentPlan === targetPlan && currentCycle === targetCycle) {
    return {
      type: 'same',
      allowImmediate: false,
      shouldSchedule: false,
      amount,
      code: 'ALREADY_ON_PLAN',
      message: 'You are already on this plan and billing cycle.',
    };
  }

  // Same plan, monthly → annual = treat as upgrade (extends/improves the window).
  if (currentPlan === targetPlan && currentCycle === 'monthly' && targetCycle === 'annual') {
    return {
      type: 'cycle_upgrade',
      allowImmediate: true,
      shouldSchedule: false,
      amount,
    };
  }

  // Same plan, annual → monthly = downgrade. Schedule at renewal.
  if (currentPlan === targetPlan && currentCycle === 'annual' && targetCycle === 'monthly') {
    return {
      type: 'cycle_downgrade',
      allowImmediate: false,
      shouldSchedule: true,
      amount,
      code: 'CYCLE_DOWNGRADE_SCHEDULED',
      message:
        'You will be moved to monthly billing at the end of your current annual cycle.',
    };
  }

  // Plan upgrade — allowed immediately.
  if (newRank > currentRank) {
    return {
      type: 'upgrade',
      allowImmediate: true,
      shouldSchedule: false,
      amount,
    };
  }

  // Plan downgrade — must be scheduled, and the student count must fit the
  // target plan's cap so we don't end up over-cap on the new tier.
  if (newRank < currentRank) {
    const targetCap = pricing.getStudentCap(targetPlan);
    const count = sub.activeStudentCount || 0;
    if (targetCap !== null && count > targetCap) {
      return {
        type: 'downgrade',
        allowImmediate: false,
        shouldSchedule: false,
        amount,
        code: 'STUDENT_CAP_EXCEEDED',
        message: `You have ${count} active students. Reduce to ${targetCap} before downgrading to ${pricing.getPlan(targetPlan).label}.`,
      };
    }
    return {
      type: 'downgrade',
      allowImmediate: false,
      shouldSchedule: true,
      amount,
      code: 'DOWNGRADE_SCHEDULED',
      message: `Your downgrade to ${pricing.getPlan(targetPlan).label} will take effect at the next renewal.`,
    };
  }

  // currentRank === newRank but cycles differ — handled above. Shouldn't reach.
  return {
    type: 'same',
    allowImmediate: false,
    shouldSchedule: false,
    amount,
    code: 'NO_CHANGE',
    message: 'No change detected.',
  };
};

module.exports = { evaluate };
