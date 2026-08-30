import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Layout from '../../components/common/Layout';
import AttendanceSummary from '../../components/student/AttendanceSummary';
import EmptyState from '../../components/common/EmptyState';
import { getAttendance } from '../../api/student.api';
import useApi from '../../hooks/useApi';
import { fadeInUp } from '../../utils/animationVariants';

const MONTHS_SHOWN = 12;

/**
 * The last 12 months as { value: 'YYYY-MM', label: 'August 2026' }.
 *
 * A native <input type="month"> renders as an empty grey box on iOS Safari —
 * no placeholder, no visible value — so students cannot tell what is selected.
 * A plain <select> always shows its current option on every platform.
 */
function recentMonths(from = new Date()) {
  return Array.from({ length: MONTHS_SHOWN }, (_, i) => {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    return { value, label };
  });
}

export default function AttendancePage() {
  const { data, loading, error, execute } = useApi(getAttendance);
  const [month, setMonth] = useState('');

  const months = useMemo(() => recentMonths(), []);

  useEffect(() => {
    execute(month || undefined);
  }, [execute, month]);

  const selectedLabel = months.find((m) => m.value === month)?.label;

  return (
    <Layout role="student">
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="max-w-2xl"
      >
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Attendance</h1>
            <p className="text-sm text-gray-500 mt-1">
              {selectedLabel ? `Showing ${selectedLabel}` : 'Showing all months'}
            </p>
          </div>

          <div className="sm:w-52">
            <label
              htmlFor="month-filter"
              className="block text-xs font-medium text-gray-500 mb-1"
            >
              Filter by month
            </label>
            <select
              id="month-filter"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full bg-white px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">All months</option>
              {months.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        {loading && (
          <p className="text-gray-500 text-sm">Loading attendance…</p>
        )}
        {error && (
          <p className="text-red-500 text-sm">{error}</p>
        )}
        {!loading && !error && (!data?.data?.records?.length ? (
          <EmptyState
            title={selectedLabel ? `No attendance in ${selectedLabel}` : 'No attendance records yet'}
            message={
              selectedLabel
                ? 'Pick another month, or choose "All months" to see everything.'
                : 'Attendance will appear after your first class.'
            }
          />
        ) : (
          <AttendanceSummary summary={data?.data} />
        ))}
      </motion.div>
    </Layout>
  );
}
