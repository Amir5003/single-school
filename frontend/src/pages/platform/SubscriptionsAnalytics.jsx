import { useEffect, useState } from 'react';
import PlatformLayout from '../../components/common/PlatformLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
  getPlatformSubscriptionAnalytics,
  listPlatformSubscriptions,
} from '../../api/subscription.api';

const STATUS_BADGE = {
  trial: 'bg-indigo-100 text-indigo-800',
  trial_limit_reached: 'bg-amber-100 text-amber-800',
  grace_period: 'bg-orange-100 text-orange-800',
  active: 'bg-emerald-100 text-emerald-800',
  expired: 'bg-rose-100 text-rose-800',
  cancelled: 'bg-gray-200 text-gray-700',
};

const Card = ({ label, value, accent = 'gray' }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-gray-200 p-5`}>
    <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
    <p className={`mt-2 text-3xl font-bold ${accent === 'rose' ? 'text-rose-600' : accent === 'emerald' ? 'text-emerald-600' : accent === 'amber' ? 'text-amber-600' : 'text-gray-900'}`}>
      {value}
    </p>
  </div>
);

const formatINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const formatDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');

export default function SubscriptionsAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [list, setList] = useState({ schools: [], total: 0 });
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getPlatformSubscriptionAnalytics(),
      listPlatformSubscriptions({ limit: 100, ...(filter ? { status: filter } : {}) }),
    ])
      .then(([a, l]) => {
        if (cancelled) return;
        setAnalytics(a.data.analytics);
        setList(l.data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filter]);

  if (loading && !analytics) {
    return (
      <PlatformLayout>
        <div className="p-6"><LoadingSpinner /></div>
      </PlatformLayout>
    );
  }

  const totals = analytics?.totals || {};

  return (
    <PlatformLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
          <p className="text-sm text-gray-600 mt-1">
            Platform-wide subscription health, conversion pipeline and revenue.
          </p>
        </header>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card label="Total schools" value={analytics?.totalSchools || 0} />
          <Card label="Active" value={totals.active || 0} accent="emerald" />
          <Card label="Trial" value={(totals.trial || 0) + (totals.trial_limit_reached || 0)} />
          <Card label="Grace" value={totals.grace_period || 0} accent="amber" />
          <Card label="Expired" value={totals.expired || 0} accent="rose" />
          <Card label="Cancelled" value={totals.cancelled || 0} />
          <Card label="Near conversion" value={analytics?.nearConversion?.length || 0} accent="amber" />
          <Card label="Estimated MRR" value={formatINR(analytics?.estimatedMRR)} accent="emerald" />
        </section>

        {analytics?.nearConversion?.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-200">
            <header className="p-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">
                Near conversion ({analytics.nearConversion.length})
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Trial schools approaching the student cap or trial expiry.
              </p>
            </header>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-2">School</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Students</th>
                  <th className="px-4 py-2">Trial ends</th>
                </tr>
              </thead>
              <tbody>
                {analytics.nearConversion.map((s) => (
                  <tr key={s._id} className="border-t border-gray-100">
                    <td className="px-4 py-2 font-medium text-gray-900">{s.name}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_BADGE[s.subscription?.status] || 'bg-gray-100'}`}>
                        {(s.subscription?.status || '').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {s.subscription?.activeStudentCount || 0} / {s.subscription?.maxTrialStudents || 50}
                    </td>
                    <td className="px-4 py-2 text-gray-700">{formatDate(s.subscription?.trialEndsAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="bg-white rounded-2xl shadow-sm border border-gray-200">
          <header className="p-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">All subscriptions</h2>
              <p className="text-xs text-gray-500 mt-0.5">{list.total} total</p>
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5"
            >
              <option value="">All statuses</option>
              <option value="trial">Trial</option>
              <option value="trial_limit_reached">Trial limit reached</option>
              <option value="grace_period">Grace</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </header>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-2">School</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Plan</th>
                <th className="px-4 py-2">Students</th>
                <th className="px-4 py-2">Next billing</th>
              </tr>
            </thead>
            <tbody>
              {list.schools.map((s) => (
                <tr key={s._id} className="border-t border-gray-100">
                  <td className="px-4 py-2">
                    <div className="font-medium text-gray-900">{s.name}</div>
                    <div className="text-xs text-gray-500">/schools/{s.slug}</div>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_BADGE[s.subscription?.status] || 'bg-gray-100'}`}>
                      {(s.subscription?.status || '').replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-700">{s.subscription?.planType || '—'}</td>
                  <td className="px-4 py-2 text-gray-700">{s.subscription?.activeStudentCount || 0}</td>
                  <td className="px-4 py-2 text-gray-700">{formatDate(s.subscription?.nextBillingDate || s.subscription?.subscriptionEndsAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </PlatformLayout>
  );
}
