import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Layout from '../../components/common/Layout';
import AttendanceSummary from '../../components/student/AttendanceSummary';
import EmptyState from '../../components/common/EmptyState';
import { getAttendance } from '../../api/student.api';
import useApi from '../../hooks/useApi';
import { fadeInUp } from '../../utils/animationVariants';

export default function AttendancePage() {
  const { data, loading, error, execute } = useApi(getAttendance);
  const [month, setMonth] = useState('');

  useEffect(() => {
    execute(month || undefined);
  }, [execute, month]);

  return (
    <Layout role="student">
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="max-w-2xl"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Attendance</h1>
          <div className="flex items-center gap-2">
            <label htmlFor="month-filter" className="text-sm text-gray-600 whitespace-nowrap">
              Filter by month
            </label>
            <input
              id="month-filter"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            {month && (
              <button
                onClick={() => setMonth('')}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {loading && (
          <p className="text-gray-500 text-sm">Loading attendance…</p>
        )}
        {error && (
          <p className="text-red-500 text-sm">{error}</p>
        )}
        {!loading && !error && (!data?.data?.records?.length ? (
          <EmptyState message="No attendance records" />
        ) : (
          <AttendanceSummary summary={data?.data} />
        ))}
      </motion.div>
    </Layout>
  );
}
