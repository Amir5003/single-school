import Countdown from '../../common/Countdown';

const STYLES = {
  trial: {
    bg: 'bg-gradient-to-r from-indigo-600 to-violet-600',
    label: 'Free trial',
  },
  trial_limit_reached: {
    bg: 'bg-gradient-to-r from-amber-500 to-orange-600',
    label: 'Trial student limit reached',
  },
  grace_period: {
    bg: 'bg-gradient-to-r from-orange-600 to-rose-600',
    label: 'Grace period',
  },
  active: {
    bg: 'bg-gradient-to-r from-emerald-600 to-teal-600',
    label: 'Active',
  },
  expired: {
    bg: 'bg-gradient-to-r from-rose-700 to-pink-700',
    label: 'Subscription expired',
  },
  cancelled: {
    bg: 'bg-gradient-to-r from-gray-700 to-gray-900',
    label: 'Subscription cancelled',
  },
};

const messageFor = (summary) => {
  if (!summary) return null;
  switch (summary.status) {
    case 'trial':
      return `${summary.activeStudentCount}/${summary.maxTrialStudents} trial students used`;
    case 'trial_limit_reached':
      return `You've hit the ${summary.maxTrialStudents}-student trial cap. Upgrade to keep adding students.`;
    case 'grace_period':
      return 'Your free trial has ended. Pay before the grace period closes to avoid interruption.';
    case 'active':
      return summary.nextBillingDate
        ? `Renews ${new Date(summary.nextBillingDate).toLocaleDateString()}`
        : 'Subscription active';
    case 'expired':
      return 'Write actions are disabled. Upgrade to restore full access.';
    case 'cancelled':
      return 'Your subscription has been cancelled. Reactivate it to keep using the platform.';
    default:
      return null;
  }
};

const endsAtFor = (summary) => {
  if (!summary) return null;
  if (summary.status === 'trial' || summary.status === 'trial_limit_reached') {
    return summary.trialEndsAt;
  }
  if (summary.status === 'grace_period') return summary.graceEndsAt;
  return null;
};

/**
 * Slim coloured banner pinned above the admin layout. Click → primary CTA
 * (open UpgradeModal). The banner is hidden when status is `active` and the
 * renewal date is more than 10 days out (so we don't nag).
 */
export default function SubscriptionBanner({ summary, onUpgradeClick }) {
  if (!summary) return null;
  const status = summary.status;

  if (status === 'active') {
    // Show only if billing is within 10 days
    if (summary.daysUntilSubscriptionEnd != null && summary.daysUntilSubscriptionEnd > 10) {
      return null;
    }
  }

  const style = STYLES[status] || STYLES.trial;
  const endsAt = endsAtFor(summary);
  const message = messageFor(summary);

  const ctaLabel = status === 'active' ? 'Renew now' : 'Upgrade';
  const showCta = status !== 'active' || (summary.daysUntilSubscriptionEnd ?? 99) <= 10;

  return (
    <div className={`${style.bg} text-white text-sm`} role="status">
      <div className="px-4 md:px-6 py-2 flex items-center gap-3 flex-wrap">
        <span className="font-semibold uppercase text-[11px] tracking-wider bg-white/15 px-2 py-0.5 rounded-full">
          {style.label}
        </span>
        <span className="flex-1 truncate">{message}</span>
        {endsAt && (
          <span className="hidden sm:inline-flex items-center gap-2 text-white/90">
            <span className="text-xs uppercase tracking-wider opacity-80">Ends in</span>
            <Countdown endsAt={endsAt} showSeconds={false} compact />
          </span>
        )}
        {showCta && (
          <button
            type="button"
            onClick={onUpgradeClick}
            className="ml-auto px-3 py-1 rounded-lg bg-white text-gray-900 text-xs font-semibold hover:bg-gray-100 transition"
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </div>
  );
}
