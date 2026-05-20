import { useEffect } from 'react';
import { motion } from 'framer-motion';
import Layout from '../../components/common/Layout';
import TimetableCard from '../../components/student/TimetableCard';
import EmptyState from '../../components/common/EmptyState';
import { getTimetable } from '../../api/student.api';
import useApi from '../../hooks/useApi';
import { fadeInUp } from '../../utils/animationVariants';

export default function TimetablePage() {
  const { data, loading, error, execute } = useApi(getTimetable);

  useEffect(() => {
    execute();
  }, [execute]);

  const periods = data?.data?.periods ?? [];

  return (
    <Layout role="student">
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="max-w-3xl"
      >
        <h1 className="text-2xl font-bold text-gray-900 mb-6">My Timetable</h1>

        {loading && (
          <p className="text-gray-500 text-sm">Loading timetable…</p>
        )}
        {error && (
          <p className="text-red-500 text-sm">{error}</p>
        )}
        {!loading && !error && periods.length === 0 && (
          <EmptyState
            title="No timetable set yet"
            message="Your school admin will add your class schedule soon."
          />
        )}
        {!loading && !error && periods.length > 0 && (
          <TimetableCard periods={periods} />
        )}
      </motion.div>
    </Layout>
  );
}
