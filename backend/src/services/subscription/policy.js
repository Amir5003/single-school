/**
 * Subscription access policy — the single source of truth for "who can do what
 * given the current subscription state".
 *
 * Operations:
 *   - read                — every authenticated GET (never enforced via this
 *                           module; reads are always allowed)
 *   - admin_write         — admin POST/PUT/PATCH/DELETE outside billing
 *   - teacher_write       — teacher POST/PUT/PATCH/DELETE
 *   - student_onboarding  — POST /admin/students (extra trial-limit + plan-cap guard)
 *   - billing             — /subscription/* (always allowed once authorized)
 *
 * Returns { allow, code?, message? } so the middleware can craft a clean
 * 402 response.
 */

const pricing = require('./pricing.service');

const ALLOW = { allow: true };

const deny = (code, message) => ({ allow: false, code, message });

const MATRIX = {
  trial: {
    read: ALLOW,
    admin_write: ALLOW,
    teacher_write: ALLOW,
    student_onboarding: ALLOW, // additional limit check below
    billing: ALLOW,
  },
  trial_limit_reached: {
    read: ALLOW,
    admin_write: ALLOW,
    teacher_write: ALLOW,
    student_onboarding: deny(
      'TRIAL_STUDENT_LIMIT_REACHED',
      'You have hit the free-trial student limit. Upgrade your plan to keep adding students.'
    ),
    billing: ALLOW,
  },
  grace_period: {
    read: ALLOW,
    admin_write: ALLOW,
    teacher_write: ALLOW,
    student_onboarding: ALLOW,
    billing: ALLOW,
  },
  active: {
    read: ALLOW,
    admin_write: ALLOW,
    teacher_write: ALLOW,
    student_onboarding: ALLOW,
    billing: ALLOW,
  },
  expired: {
    read: ALLOW,
    admin_write: deny(
      'SUBSCRIPTION_EXPIRED',
      'Your school subscription has expired. Please upgrade to continue making changes.'
    ),
    teacher_write: deny(
      'SUBSCRIPTION_EXPIRED',
      'School subscription has expired. Please contact your school administration.'
    ),
    student_onboarding: deny(
      'SUBSCRIPTION_EXPIRED',
      'Your school subscription has expired. Please upgrade to add new students.'
    ),
    billing: ALLOW,
  },
  cancelled: {
    read: ALLOW,
    admin_write: deny(
      'SUBSCRIPTION_CANCELLED',
      'Your subscription has been cancelled. Reactivate it to continue making changes.'
    ),
    teacher_write: deny(
      'SUBSCRIPTION_CANCELLED',
      'Your school subscription has been cancelled. Please contact your school administration.'
    ),
    student_onboarding: deny(
      'SUBSCRIPTION_CANCELLED',
      'Your subscription has been cancelled. Reactivate it to add new students.'
    ),
    billing: ALLOW,
  },
};

/**
 * Pure function — evaluates whether the given role + operation is allowed
 * under the given subscription state.
 *
 * @param {object} args
 * @param {string} args.status              Current subscription.status
 * @param {string} args.role                req.user.role
 * @param {string} args.op                  Operation kind
 * @param {object} [args.subscription]      Full subscription subdoc (for extra
 *                                          checks like trial-limit re-evaluation)
 * @returns {{ allow: boolean, code?: string, message?: string }}
 */
const evaluate = ({ status, role, op, subscription = {} }) => {
  // Super-admin always bypasses subscription rules at the policy level too.
  if (role === 'super-admin') return ALLOW;

  // Students and parents are read-only by route design — they don't reach
  // mutating handlers. If they ever do, treat anything other than `read` as
  // a hard deny so we fail closed.
  if (role === 'student' || role === 'parent') {
    if (op === 'read' || op === 'billing') return ALLOW;
    return deny(
      'NOT_ALLOWED',
      'Students and parents are not permitted to perform write operations.'
    );
  }

  // Billing endpoints are restricted to school-admin via authorize() — once
  // that passes, policy allows.
  if (op === 'billing') return ALLOW;

  const stateMatrix = MATRIX[status];
  if (!stateMatrix) {
    // Defensive — unknown status, fail closed.
    return deny('UNKNOWN_SUBSCRIPTION_STATUS', 'Subscription state is invalid.');
  }

  const decision = stateMatrix[op];
  if (!decision) {
    return deny('UNKNOWN_OPERATION', 'Unknown operation kind.');
  }

  // Defensive trial-limit guard: if we're still inside the trial window
  // numerically but activeStudentCount somehow reached the cap, treat
  // student_onboarding as blocked even when status is still 'trial'.
  if (
    op === 'student_onboarding' &&
    decision.allow &&
    subscription &&
    typeof subscription.activeStudentCount === 'number' &&
    typeof subscription.maxTrialStudents === 'number' &&
    (status === 'trial' || status === 'trial_limit_reached') &&
    subscription.activeStudentCount >= subscription.maxTrialStudents
  ) {
    return deny(
      'TRIAL_STUDENT_LIMIT_REACHED',
      'You have hit the free-trial student limit. Upgrade your plan to keep adding students.'
    );
  }

  // Active-plan cap guard: when paid, enforce the selected plan's student cap.
  if (
    op === 'student_onboarding' &&
    decision.allow &&
    subscription &&
    status === 'active' &&
    typeof subscription.activeStudentCount === 'number' &&
    subscription.planType
  ) {
    let cap = null;
    try {
      cap = pricing.getStudentCap(subscription.planType);
    } catch {
      cap = null;
    }
    if (cap !== null && subscription.activeStudentCount >= cap) {
      return deny(
        'PLAN_STUDENT_CAP_REACHED',
        `Your current plan supports up to ${cap} active students. Upgrade your plan to add more.`
      );
    }
  }

  return decision;
};

module.exports = {
  evaluate,
  MATRIX,
};
