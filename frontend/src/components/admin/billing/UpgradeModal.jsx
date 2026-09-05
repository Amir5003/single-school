import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDispatch } from 'react-redux';
import PlanCard from './PlanCard';
import PricingSummary from './PricingSummary';
import {
  createUpgradeOrder,
  verifySubscriptionPayment,
  scheduleDowngrade as scheduleDowngradeApi,
} from '../../../api/subscription.api';
import { fetchSuccess } from '../../../redux/slices/subscriptionSlice';
import useSubscription from '../../../hooks/useSubscription';

const RAZORPAY_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

const PLAN_RANK = { starter: 1, standard: 2, premium: 3 };

const loadRazorpayScript = () =>
  new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(window.Razorpay);
    const existing = document.querySelector(`script[src="${RAZORPAY_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Razorpay));
      existing.addEventListener('error', () => reject(new Error('Razorpay load failed')));
      return;
    }
    const s = document.createElement('script');
    s.src = RAZORPAY_SCRIPT;
    s.async = true;
    s.onload = () => resolve(window.Razorpay);
    s.onerror = () => reject(new Error('Razorpay load failed'));
    document.body.appendChild(s);
  });

const STEP = {
  PLAN: 'plan',
  REVIEW: 'review',
  CONFIRM_SCHEDULE: 'confirm_schedule',
  PAYING: 'paying',
  VERIFYING: 'verifying',
  SUCCESS: 'success',
  SCHEDULED: 'scheduled',
  ERROR: 'error',
};

/**
 * Decide whether `target` is an upgrade / downgrade / same vs. the school's
 * current plan + cycle. Used to lock cards and label the CTA.
 */
const classifyChange = ({ summary, targetPlan, targetCycle }) => {
  if (!summary || summary.status !== 'active') return 'initial';
  const currentRank = PLAN_RANK[summary.planType] || 0;
  const newRank = PLAN_RANK[targetPlan] || 0;
  if (summary.planType === targetPlan && summary.billingCycle === targetCycle) return 'same';
  if (summary.planType === targetPlan && summary.billingCycle === 'monthly' && targetCycle === 'annual') return 'cycle_upgrade';
  if (summary.planType === targetPlan && summary.billingCycle === 'annual' && targetCycle === 'monthly') return 'cycle_downgrade';
  if (newRank > currentRank) return 'upgrade';
  if (newRank < currentRank) return 'downgrade';
  return 'same';
};

const isDowngradeChange = (kind) => kind === 'downgrade' || kind === 'cycle_downgrade';

/**
 * Returns a reason string when the given plan can't be selected, or null when allowed.
 * `disabledReason` is shown inside the card; `currentPlan` shows the "Current" badge.
 */
const evaluatePlanDisability = ({ summary, plan }) => {
  // Coming-soon plans are unselectable regardless of subscription state.
  if (plan.comingSoon) {
    return `${plan.label} is coming soon. We'll enable it as soon as it's ready.`;
  }
  if (!summary) return null;
  if (summary.status !== 'active') return null;
  // Cap conflict on downgrade — over-cap students can't move to a lower tier.
  if (
    plan.studentCap != null &&
    summary.activeStudentCount > plan.studentCap &&
    (PLAN_RANK[plan.id] || 0) < (PLAN_RANK[summary.planType] || 0)
  ) {
    return `You have ${summary.activeStudentCount} active students. Reduce to ${plan.studentCap} before switching to ${plan.label}.`;
  }
  return null;
};

export default function UpgradeModal({
  open,
  onClose,
  reason = 'manual',
  summary,
  plans = [],
  dismissible = true,
  onSecondaryAction,
}) {
  const dispatch = useDispatch();
  const { pollUntilActive, refresh } = useSubscription({ autoFetch: false });
  const [step, setStep] = useState(STEP.PLAN);
  const [billingCycle, setBillingCycle] = useState(summary?.billingCycle || 'monthly');
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [error, setError] = useState(null);
  // Acknowledged at the moment money moves. Separate from the signup
  // acceptance, which may be months old and made by a different person.
  const [acceptedBilling, setAcceptedBilling] = useState(false);
  const backdropRef = useRef(null);

  // Annual discount % is the same across plans; read it from the API payload
  // instead of hard-coding, so it tracks backend pricing config.
  const annualPct = Math.round(
    ((plans?.[0]?.pricing?.annualDiscountPct) ?? 0.15) * 100
  );

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) || null,
    [plans, selectedPlanId]
  );

  const changeKind = useMemo(
    () => classifyChange({ summary, targetPlan: selectedPlanId, targetCycle: billingCycle }),
    [summary, selectedPlanId, billingCycle]
  );

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setStep(STEP.PLAN);
      setError(null);
      setBillingCycle(summary?.billingCycle || 'monthly');
      // Default selection: recommended plan, unless the school is already on
      // an active plan — then prefer the next tier up.
      const selectable = plans.filter((p) => !p.comingSoon);
      if (selectable.length > 0) {
        if (summary?.status === 'active' && summary.planType) {
          const currentRank = PLAN_RANK[summary.planType] || 0;
          const nextUp = selectable.find((p) => (PLAN_RANK[p.id] || 0) > currentRank);
          setSelectedPlanId(
            nextUp?.id ||
              selectable.find((p) => p.recommended)?.id ||
              selectable[0].id
          );
        } else {
          setSelectedPlanId(
            selectable.find((p) => p.recommended)?.id || selectable[0].id
          );
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (
        e.key === 'Escape' &&
        dismissible &&
        step !== STEP.PAYING &&
        step !== STEP.VERIFYING
      ) {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, dismissible, step, onClose]);

  if (!open) return null;

  const handleBackdropClick = (e) => {
    if (
      e.target === backdropRef.current &&
      dismissible &&
      step !== STEP.PAYING &&
      step !== STEP.VERIFYING
    ) {
      onClose?.();
    }
  };

  const headerCopy = (() => {
    switch (reason) {
      case 'trial_limit_reached':
        return {
          eyebrow: 'Trial limit reached',
          title: `You've added ${summary?.activeStudentCount || 0} of ${summary?.maxTrialStudents || 50} trial students`,
          subtitle: 'Upgrade now to keep adding students. Your data and team stay exactly where they are.',
          accent: 'amber',
        };
      case 'grace_period':
        return {
          eyebrow: 'Trial ended — grace period active',
          title: 'Your free trial has ended. You have a few days to pay before your account becomes read-only.',
          subtitle: 'Upgrade now to keep full access without interruption.',
          accent: 'orange',
        };
      case 'expired':
        return {
          eyebrow: 'Subscription expired',
          title: 'Your school is now read-only',
          subtitle: 'Upgrade to restore write access for your team. All existing data is safe and untouched.',
          accent: 'rose',
        };
      default:
        return {
          eyebrow: summary?.status === 'active' ? 'Change plan' : 'Upgrade plan',
          title:
            summary?.status === 'active'
              ? 'Choose a different plan or billing cycle'
              : 'Choose the right plan for your school',
          subtitle: `Switch cycles anytime — annual saves you ${annualPct}%. Cancel anytime.`,
          accent: 'indigo',
        };
    }
  })();

  const accentMap = {
    amber: 'from-amber-500 via-orange-500 to-rose-500',
    orange: 'from-orange-500 via-rose-500 to-pink-500',
    rose: 'from-rose-600 via-pink-600 to-fuchsia-600',
    indigo: 'from-indigo-600 via-violet-600 to-purple-600',
  };

  const isDowngrade = isDowngradeChange(changeKind);
  const isSame = changeKind === 'same';

  // CTA label changes with the kind of change.
  const ctaLabel = (() => {
    if (!selectedPlan) return 'Continue';
    if (isSame) return 'Already on this plan';
    if (isDowngrade) return 'Schedule downgrade';
    const amount =
      billingCycle === 'annual'
        ? selectedPlan.pricing.annual
        : selectedPlan.pricing.monthly;
    return `Pay ₹${amount.toLocaleString('en-IN')}`;
  })();

  const startPayment = async () => {
    if (!selectedPlan) return;
    setError(null);
    setStep(STEP.PAYING);

    try {
      const { data } = await createUpgradeOrder({
        planType: selectedPlan.id,
        billingCycle,
      });
      const order = data.order;

      // Stub-mode short-circuit (local dev / staging without Razorpay)
      if (!order.isLive) {
        setStep(STEP.VERIFYING);
        const verification = await verifySubscriptionPayment({
          orderId: order.orderId,
          providerPaymentId: `pay_stub_${Date.now()}`,
          providerSignature: 'stub_signature',
          planType: selectedPlan.id,
          billingCycle,
        });
        dispatch(fetchSuccess({ subscription: verification.data.subscription, plans }));
        setStep(STEP.SUCCESS);
        setTimeout(() => onClose?.(), 2200);
        return;
      }

      const Razorpay = await loadRazorpayScript();
      const rzp = new Razorpay({
        key: order.keyId,
        amount: order.amount * 100,
        currency: order.currency,
        order_id: order.providerOrderId,
        name: 'School Management',
        description: `${selectedPlan.label} (${billingCycle === 'annual' ? 'Annual' : 'Monthly'})`,
        notes: {
          schoolId: summary?.schoolId,
          planType: selectedPlan.id,
          billingCycle,
        },
        theme: { color: '#4f46e5' },
        modal: {
          ondismiss: () => setStep(STEP.PLAN),
        },
        handler: async (response) => {
          try {
            setStep(STEP.VERIFYING);
            const verification = await verifySubscriptionPayment({
              orderId: order.providerOrderId,
              providerPaymentId: response.razorpay_payment_id,
              providerSignature: response.razorpay_signature,
              planType: selectedPlan.id,
              billingCycle,
            });
            try {
              await pollUntilActive({ intervalMs: 1500, timeoutMs: 12000 });
            } catch {
              dispatch(fetchSuccess({ subscription: verification.data.subscription, plans }));
            }
            setStep(STEP.SUCCESS);
            setTimeout(() => onClose?.(), 2500);
          } catch (err) {
            setError(err?.response?.data?.message || err.message);
            setStep(STEP.ERROR);
          }
        },
      });
      rzp.open();
    } catch (err) {
      const body = err?.response?.data;
      // If the server says we should schedule (downgrade detected), drop into
      // the schedule-confirm flow instead of erroring.
      if (body?.shouldSchedule) {
        setError(body.message || 'Downgrades take effect at renewal.');
        setStep(STEP.CONFIRM_SCHEDULE);
        return;
      }
      if (body?.code === 'ALREADY_ON_PLAN') {
        setError(body.message || 'You are already on this plan.');
        setStep(STEP.ERROR);
        return;
      }
      setError(body?.message || err.message);
      setStep(STEP.ERROR);
    }
  };

  const confirmSchedule = async () => {
    if (!selectedPlan) return;
    setError(null);
    setStep(STEP.VERIFYING);
    try {
      const result = await scheduleDowngradeApi({
        planType: selectedPlan.id,
        billingCycle,
      });
      dispatch(fetchSuccess({ subscription: result.data.subscription, plans }));
      await refresh().catch(() => {});
      setStep(STEP.SCHEDULED);
      setTimeout(() => onClose?.(), 2800);
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
      setStep(STEP.ERROR);
    }
  };

  const primaryAction = () => {
    if (step === STEP.PLAN) {
      if (isSame) return;
      setStep(STEP.REVIEW);
      return;
    }
    if (step === STEP.REVIEW) {
      if (isDowngrade) {
        setStep(STEP.CONFIRM_SCHEDULE);
        return;
      }
      startPayment();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        ref={backdropRef}
        onMouseDown={handleBackdropClick}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          key="dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="upgrade-modal-title"
          initial={{ opacity: 0, y: 32, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          className="relative w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col"
        >
          <div className={`h-1.5 bg-gradient-to-r ${accentMap[headerCopy.accent]}`} />

          <div className="px-7 pt-6 pb-4 border-b border-gray-100 flex items-start gap-4">
            <div className="flex-1">
              <p
                className={`text-xs font-semibold uppercase tracking-wider ${
                  headerCopy.accent === 'rose'
                    ? 'text-rose-600'
                    : headerCopy.accent === 'orange'
                      ? 'text-orange-600'
                      : headerCopy.accent === 'amber'
                        ? 'text-amber-600'
                        : 'text-indigo-600'
                }`}
              >
                {headerCopy.eyebrow}
              </p>
              <h2
                id="upgrade-modal-title"
                className="mt-1 text-xl font-bold text-gray-900 leading-tight"
              >
                {headerCopy.title}
              </h2>
              <p className="mt-1 text-sm text-gray-600 max-w-xl">{headerCopy.subtitle}</p>
            </div>
            {dismissible && step !== STEP.PAYING && step !== STEP.VERIFYING && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="text-gray-400 hover:text-gray-700 rounded-full p-1 transition"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>

          {/* Billing cycle toggle — only shown in plan/review steps */}
          {(step === STEP.PLAN || step === STEP.REVIEW) && (
            <div className="px-7 pt-4 pb-2 flex items-center justify-center">
              <div
                role="tablist"
                aria-label="Billing cycle"
                className="inline-flex bg-gray-100 rounded-full p-1 relative"
              >
                <button
                  role="tab"
                  type="button"
                  aria-selected={billingCycle === 'monthly'}
                  onClick={() => setBillingCycle('monthly')}
                  className={`relative px-5 py-1.5 text-sm rounded-full font-medium transition ${
                    billingCycle === 'monthly'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Monthly
                </button>
                <button
                  role="tab"
                  type="button"
                  aria-selected={billingCycle === 'annual'}
                  onClick={() => setBillingCycle('annual')}
                  className={`relative px-5 py-1.5 text-sm rounded-full font-medium transition flex items-center gap-1.5 ${
                    billingCycle === 'annual'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Annual
                  <span className="text-[10px] font-semibold uppercase tracking-wider bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
                    Save {annualPct}%
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {step === STEP.PLAN && (
              <div className="px-7 py-5 grid md:grid-cols-3 gap-4">
                {plans.map((plan) => {
                  const disabledReason = evaluatePlanDisability({ summary, plan });
                  const isCurrentBoth =
                    summary?.status === 'active' &&
                    summary.planType === plan.id &&
                    summary.billingCycle === billingCycle;
                  return (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      billingCycle={billingCycle}
                      currentPlan={summary?.status === 'active' ? summary.planType : null}
                      selected={selectedPlanId === plan.id && !isCurrentBoth}
                      disabled={Boolean(disabledReason) || isCurrentBoth}
                      disabledReason={
                        disabledReason ||
                        (isCurrentBoth
                          ? `You're already on ${plan.label} (${billingCycle}).`
                          : '')
                      }
                      onSelect={() => setSelectedPlanId(plan.id)}
                    />
                  );
                })}
              </div>
            )}

            {step === STEP.REVIEW && (
              <div className="px-7 py-5 grid md:grid-cols-5 gap-6">
                <div className="md:col-span-3">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    {isDowngrade
                      ? 'You will downgrade to'
                      : changeKind === 'cycle_upgrade'
                        ? 'You will switch to annual billing for'
                        : "You're upgrading to"}
                  </h3>
                  <PlanCard
                    plan={selectedPlan}
                    billingCycle={billingCycle}
                    selected
                    onSelect={() => {}}
                  />
                  <button
                    type="button"
                    className="mt-3 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                    onClick={() => setStep(STEP.PLAN)}
                  >
                    ← Change plan
                  </button>
                </div>
                <div className="md:col-span-2">
                  <PricingSummary plan={selectedPlan} billingCycle={billingCycle} />
                  {isDowngrade && (
                    <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                      <p className="font-semibold">Downgrades take effect at renewal</p>
                      <p className="mt-1 text-amber-700">
                        No charge today. We'll switch you to{' '}
                        <strong>{selectedPlan?.label} ({billingCycle})</strong> when your
                        current cycle ends on{' '}
                        <strong>
                          {summary?.subscriptionEndsAt
                            ? new Date(summary.subscriptionEndsAt).toLocaleDateString('en-IN', { dateStyle: 'long' })
                            : 'the next billing date'}
                        </strong>.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === STEP.CONFIRM_SCHEDULE && (
              <div className="px-7 py-12 flex flex-col items-center text-center">
                <div className="h-14 w-14 rounded-full bg-amber-100 flex items-center justify-center">
                  <svg className="h-7 w-7 text-amber-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .2.08.39.22.53l3 3a.75.75 0 101.06-1.06L10.75 9.69V5z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">
                  Schedule downgrade to {selectedPlan?.label}?
                </h3>
                <p className="mt-1 text-sm text-gray-600 max-w-md">
                  You'll keep your current plan until your cycle ends on{' '}
                  <strong>
                    {summary?.subscriptionEndsAt
                      ? new Date(summary.subscriptionEndsAt).toLocaleDateString('en-IN', { dateStyle: 'long' })
                      : 'the next billing date'}
                  </strong>
                  . No charge today.
                </p>
                <div className="mt-6 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(STEP.REVIEW)}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmSchedule}
                    className="px-5 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700"
                  >
                    Yes, schedule downgrade
                  </button>
                </div>
              </div>
            )}

            {(step === STEP.PAYING || step === STEP.VERIFYING) && (
              <div className="px-7 py-16 flex flex-col items-center text-center">
                <div className="relative h-16 w-16">
                  <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
                  <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
                </div>
                <h3 className="mt-6 text-lg font-semibold text-gray-900">
                  {step === STEP.PAYING ? 'Opening secure checkout…' : 'Updating your subscription…'}
                </h3>
                <p className="mt-1 text-sm text-gray-600 max-w-md">
                  {step === STEP.PAYING
                    ? 'Complete the payment in the Razorpay window. Do not close this tab.'
                    : 'Verifying your payment and switching your school to the new plan.'}
                </p>
              </div>
            )}

            {step === STEP.SUCCESS && (
              <div className="px-7 py-16 flex flex-col items-center text-center">
                <motion.div
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                  className="h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center"
                >
                  <svg className="h-10 w-10 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 011.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z" clipRule="evenodd" />
                  </svg>
                </motion.div>
                <h3 className="mt-6 text-xl font-bold text-gray-900">
                  You're on {selectedPlan?.label} {billingCycle === 'annual' ? '(Annual)' : '(Monthly)'}!
                </h3>
                <p className="mt-1 text-sm text-gray-600 max-w-md">
                  Welcome back to full access. Your team can keep working without interruption.
                </p>
              </div>
            )}

            {step === STEP.SCHEDULED && (
              <div className="px-7 py-16 flex flex-col items-center text-center">
                <motion.div
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="h-20 w-20 rounded-full bg-amber-100 flex items-center justify-center"
                >
                  <svg className="h-10 w-10 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.05 3.05a7 7 0 119.9 9.9A7 7 0 015.05 3.05zM10 6a1 1 0 011 1v3l2 2a1 1 0 01-1.42 1.42l-2.29-2.3A1 1 0 019 10V7a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                </motion.div>
                <h3 className="mt-6 text-xl font-bold text-gray-900">
                  Downgrade scheduled
                </h3>
                <p className="mt-1 text-sm text-gray-600 max-w-md">
                  You'll keep your current plan until{' '}
                  {summary?.subscriptionEndsAt
                    ? new Date(summary.subscriptionEndsAt).toLocaleDateString('en-IN', { dateStyle: 'long' })
                    : 'renewal'}
                  . You can cancel this change anytime from the Billing page.
                </p>
              </div>
            )}

            {step === STEP.ERROR && (
              <div className="px-7 py-12 flex flex-col items-center text-center">
                <div className="h-16 w-16 rounded-full bg-rose-100 flex items-center justify-center">
                  <svg className="h-8 w-8 text-rose-600" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zM10 5a1 1 0 011 1v4a1 1 0 11-2 0V6a1 1 0 011-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">Something went wrong</h3>
                <p className="mt-1 text-sm text-gray-600 max-w-md">
                  {error || 'Please try again or contact support.'}
                </p>
                <button
                  type="button"
                  className="mt-6 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
                  onClick={() => setStep(STEP.PLAN)}
                >
                  Back to plans
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          {(step === STEP.PLAN || step === STEP.REVIEW) && (
            <div className="border-t border-gray-100 px-7 py-4 bg-gray-50 space-y-3">
            <label className="flex gap-2.5 items-start cursor-pointer select-none">
              <input
                type="checkbox"
                checked={acceptedBilling}
                onChange={(e) => setAcceptedBilling(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-2 focus:ring-indigo-400"
              />
              <span className="text-xs text-gray-600 leading-relaxed">
                I understand this plan renews {billingCycle === 'annual' ? 'annually' : 'monthly'}{' '}
                until cancelled, and I have read the{' '}
                <a
                  href="/refunds"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 underline"
                >
                  Refund &amp; Cancellation Policy
                </a>
                .
              </span>
            </label>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                Secure payment powered by Razorpay
              </div>
              <div className="flex items-center gap-2">
                {!dismissible && onSecondaryAction && (
                  <button
                    type="button"
                    onClick={onSecondaryAction}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                  >
                    Continue read-only
                  </button>
                )}
                <button
                  type="button"
                  disabled={!selectedPlan || isSame || !acceptedBilling}
                  onClick={primaryAction}
                  className={[
                    'px-5 py-2 rounded-lg text-sm font-semibold transition shadow-sm',
                    isSame
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : isDowngrade
                        ? 'bg-amber-600 text-white hover:bg-amber-700'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700',
                  ].join(' ')}
                >
                  {step === STEP.PLAN ? (isSame ? 'Already on this plan' : 'Review & continue') : ctaLabel}
                </button>
              </div>
            </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
