import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectRole } from '../../redux/slices/authSlice';
import {
  dismissModal,
  selectSubscriptionDismissed,
  selectSubscriptionStatus,
} from '../../redux/slices/subscriptionSlice';
import useSubscription from '../../hooks/useSubscription';
import SubscriptionBanner from '../admin/billing/SubscriptionBanner';
import UpgradeModal from '../admin/billing/UpgradeModal';
import GracePeriodModal from '../admin/billing/GracePeriodModal';
import ExpiredModal from '../admin/billing/ExpiredModal';

/**
 * Renders the right banner+modal combo for the current role × subscription
 * state. Mounted once inside `Layout`.
 *
 * Behavior matrix:
 *  - super-admin                     → null
 *  - school-admin
 *      - trial                       → banner only (when getting close)
 *      - trial_limit_reached         → banner + auto-open UpgradeModal (dismissible)
 *      - grace_period                → banner + auto-open GracePeriodModal (dismissible)
 *      - expired / cancelled         → banner + blocking ExpiredModal (not dismissible — choose Upgrade or Continue)
 *      - active                      → banner only when nearing renewal
 *  - teacher
 *      - expired / cancelled         → single warning line under the navbar
 *      - otherwise                   → null
 *  - student / parent                → null
 */
export default function SubscriptionGate() {
  const dispatch = useDispatch();
  const role = useSelector(selectRole);
  const status = useSelector(selectSubscriptionStatus);
  const dismissed = useSelector(selectSubscriptionDismissed);

  const { summary, plans } = useSubscription({ autoFetch: role === 'school-admin' });

  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [graceOpen, setGraceOpen] = useState(false);
  const [expiredOpen, setExpiredOpen] = useState(false);

  // Auto-open the right modal on first reach
  useEffect(() => {
    if (role !== 'school-admin' || !summary) return;
    if (dismissed) return;
    if (summary.status === 'trial_limit_reached') {
      setUpgradeOpen(true);
    } else if (summary.status === 'grace_period') {
      setGraceOpen(true);
    } else if (summary.status === 'expired' || summary.status === 'cancelled') {
      setExpiredOpen(true);
    }
  }, [role, summary, dismissed]);

  // Teacher banner for expired/cancelled
  if (role === 'teacher') {
    if (status !== 'expired' && status !== 'cancelled') return null;
    return (
      <div
        className="bg-rose-50 border-b border-rose-200 text-rose-800 text-xs px-4 py-2 flex items-center gap-2"
        role="status"
      >
        <svg className="h-4 w-4 text-rose-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zM10 5a1 1 0 011 1v4a1 1 0 11-2 0V6a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
        <span>
          School subscription has expired. Please contact your school administration.
        </span>
      </div>
    );
  }

  if (role !== 'school-admin' || !summary) return null;

  const openUpgrade = () => {
    setGraceOpen(false);
    setExpiredOpen(false);
    setUpgradeOpen(true);
  };

  const closeAndRemember = () => {
    setUpgradeOpen(false);
    setGraceOpen(false);
    setExpiredOpen(false);
    dispatch(dismissModal());
  };

  const isExpired = summary.status === 'expired' || summary.status === 'cancelled';

  const reason =
    summary.status === 'trial_limit_reached'
      ? 'trial_limit_reached'
      : summary.status === 'grace_period'
        ? 'grace_period'
        : summary.status === 'expired' || summary.status === 'cancelled'
          ? 'expired'
          : 'manual';

  return (
    <>
      <SubscriptionBanner summary={summary} onUpgradeClick={openUpgrade} />

      <GracePeriodModal
        open={graceOpen && !dismissed}
        onClose={() => {
          setGraceOpen(false);
          dispatch(dismissModal());
        }}
        onUpgradeClick={openUpgrade}
        summary={summary}
      />

      <ExpiredModal
        open={expiredOpen && !dismissed}
        onUpgradeClick={openUpgrade}
        onContinueReadOnly={() => {
          setExpiredOpen(false);
          dispatch(dismissModal());
        }}
        summary={summary}
      />

      <UpgradeModal
        open={upgradeOpen}
        onClose={closeAndRemember}
        reason={reason}
        summary={summary}
        plans={plans}
        dismissible={!isExpired}
        onSecondaryAction={() => {
          setUpgradeOpen(false);
          dispatch(dismissModal());
        }}
      />
    </>
  );
}
