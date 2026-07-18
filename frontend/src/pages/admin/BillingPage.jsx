import { useEffect, useState } from 'react';
import Layout from '../../components/common/Layout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ConfirmModal from '../../components/common/ConfirmModal';
import PlanCard from '../../components/admin/billing/PlanCard';
import UpgradeModal from '../../components/admin/billing/UpgradeModal';
import useSubscription from '../../hooks/useSubscription';
import {
  cancelSubscription,
  cancelScheduledChange,
  getSubscriptionHistory,
} from '../../api/subscription.api';

const STATUS_BADGE = {
  trial: 'bg-indigo-100 text-indigo-800',
  trial_limit_reached: 'bg-amber-100 text-amber-800',
  grace_period: 'bg-orange-100 text-orange-800',
  active: 'bg-emerald-100 text-emerald-800',
  expired: 'bg-rose-100 text-rose-800',
  cancelled: 'bg-gray-200 text-gray-800',
};

const formatDate = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const formatDateShort = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { dateStyle: 'long' }) : '—';

const formatRupee = (n) =>
  typeof n === 'number' ? `₹${n.toLocaleString('en-IN')}` : '—';

const eventLabel = (type) =>
  type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

export default function BillingPage() {
  const { summary, plans, isLoading, refresh } = useSubscription();
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [cancelSubOpen, setCancelSubOpen] = useState(false);
  const [cancelScheduledOpen, setCancelScheduledOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSubscriptionHistory()
      .then((res) => {
        if (!cancelled) setHistory(res?.data?.events || []);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [summary?.status, summary?.lastPaymentAt]);

  const handleCancelSubscription = async () => {
    setCancelSubOpen(false);
    try {
      await cancelSubscription();
      await refresh();
    } catch {
      // refresh on next render
    }
  };

  const handleCancelScheduled = async () => {
    setCancelScheduledOpen(false);
    try {
      await cancelScheduledChange();
      await refresh();
    } catch {
      // refresh on next render
    }
  };

  if (isLoading && !summary) {
    return (
      <Layout role="school-admin">
        <LoadingSpinner />
      </Layout>
    );
  }

  return (
    <Layout role="school-admin">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage your plan, view payment history and renew your school's subscription.
            </p>
          </div>
          {summary && (
            <button
              type="button"
              onClick={() => setUpgradeOpen(true)}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-sm"
            >
              {summary.status === 'active' ? 'Change plan' : 'Upgrade now'}
            </button>
          )}
        </header>

        {/* Scheduled downgrade banner */}
        {summary?.scheduledChange && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
            <svg className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path fillRule="evenodd" d="M5.05 3.05a7 7 0 119.9 9.9A7 7 0 015.05 3.05zM10 6a1 1 0 011 1v3l2 2a1 1 0 01-1.42 1.42l-2.29-2.3A1 1 0 019 10V7a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            <div className="flex-1 text-sm">
              <p className="font-semibold text-amber-900">
                Downgrade scheduled — will take effect on{' '}
                {formatDateShort(summary.scheduledChange.applyAt)}
              </p>
              <p className="text-amber-800 mt-0.5">
                Your school will switch to{' '}
                <strong>
                  {summary.scheduledChange.planType} ({summary.scheduledChange.billingCycle})
                </strong>{' '}
                at the end of your current cycle. No charge will be taken — your remaining time
                stays active.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCancelScheduledOpen(true)}
              className="text-xs font-medium text-amber-900 hover:text-amber-950 underline"
            >
              Cancel downgrade
            </button>
          </div>
        )}

        {/* Plan summary card */}
        {summary && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${STATUS_BADGE[summary.status] || 'bg-gray-100 text-gray-700'}`}>
                    {summary.status.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs text-gray-500 capitalize">
                    {summary.planType} · {summary.billingCycle}
                  </span>
                </div>
                <p className="mt-3 text-3xl font-bold text-gray-900">
                  {formatRupee(summary.currentCycleAmount)}
                  <span className="text-sm font-medium text-gray-500">
                    {summary.billingCycle === 'annual' ? ' / year' : ' / month'}
                  </span>
                  {summary.currentCycleListAmount > summary.currentCycleAmount && (
                    <span className="ml-2 text-lg font-medium text-gray-400 line-through">
                      {formatRupee(summary.currentCycleListAmount)}
                    </span>
                  )}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {summary.activeStudentCount} active students
                  {summary.studentCap != null && ` · cap: ${summary.studentCap.toLocaleString('en-IN')}`}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <div>
                  <dt className="text-gray-500 text-xs uppercase tracking-wider">Trial ends</dt>
                  <dd className="text-gray-900">{formatDate(summary.trialEndsAt)}</dd>
                </div>
                {summary.graceEndsAt && (
                  <div>
                    <dt className="text-gray-500 text-xs uppercase tracking-wider">Grace ends</dt>
                    <dd className="text-gray-900">{formatDate(summary.graceEndsAt)}</dd>
                  </div>
                )}
                {summary.subscriptionEndsAt && (
                  <div>
                    <dt className="text-gray-500 text-xs uppercase tracking-wider">Renews on</dt>
                    <dd className="text-gray-900">{formatDate(summary.subscriptionEndsAt)}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-gray-500 text-xs uppercase tracking-wider">Last payment</dt>
                  <dd className="text-gray-900">{formatDate(summary.lastPaymentAt)}</dd>
                </div>
              </dl>
            </div>
            {summary.status === 'active' && (
              <div className="mt-5 pt-5 border-t border-gray-100 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setCancelSubOpen(true)}
                  className="text-sm text-rose-600 hover:text-rose-700 font-medium"
                >
                  Cancel subscription
                </button>
              </div>
            )}
          </section>
        )}

        {/* Plans grid */}
        {plans.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
              Available plans
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  billingCycle={summary?.billingCycle || 'monthly'}
                  currentPlan={summary?.status === 'active' ? summary.planType : null}
                  selected={summary?.planType === plan.id && summary.status === 'active'}
                  onSelect={() => setUpgradeOpen(true)}
                />
              ))}
            </div>
          </section>
        )}

        {/* History */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200">
          <header className="p-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Payment & lifecycle history</h2>
          </header>
          {historyLoading ? (
            <div className="p-6"><LoadingSpinner /></div>
          ) : history.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">No subscription events yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-2">When</th>
                  <th className="px-4 py-2">Event</th>
                  <th className="px-4 py-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {history.map((e) => (
                  <tr key={e._id} className="border-t border-gray-100">
                    <td className="px-4 py-2 text-gray-700 whitespace-nowrap">{formatDate(e.createdAt)}</td>
                    <td className="px-4 py-2 font-medium text-gray-900">{eventLabel(e.type)}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {e.metadata?.amount
                        ? `${formatRupee(e.metadata.amount)} • `
                        : ''}
                      {e.metadata?.planType ? `Plan: ${e.metadata.planType}` : ''}
                      {e.metadata?.billingCycle ? ` (${e.metadata.billingCycle})` : ''}
                      {e.metadata?.previousStatus && e.metadata?.newStatus
                        ? ` • ${e.metadata.previousStatus} → ${e.metadata.newStatus}`
                        : ''}
                      {e.metadata?.providerPaymentId && (
                        <span className="ml-1 text-xs text-gray-400">
                          ({e.metadata.providerPaymentId})
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => {
          setUpgradeOpen(false);
          refresh().catch(() => {});
        }}
        reason="manual"
        summary={summary}
        plans={plans}
        dismissible
      />
      {cancelSubOpen && (
        <ConfirmModal
          message="Cancelling will switch your school to read-only mode. Are you sure?"
          onConfirm={handleCancelSubscription}
          onClose={() => setCancelSubOpen(false)}
        />
      )}
      {cancelScheduledOpen && (
        <ConfirmModal
          message="Cancel the scheduled downgrade? Your current plan will continue to renew on the same cycle."
          onConfirm={handleCancelScheduled}
          onClose={() => setCancelScheduledOpen(false)}
        />
      )}
    </Layout>
  );
}
