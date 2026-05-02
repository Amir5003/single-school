import { useEffect } from 'react';
import { motion } from 'framer-motion';
import Layout from '../../components/common/Layout';
import TimetableCard from '../../components/student/TimetableCard';
import { getTimetable } from '../../api/student.api';
import useApi from '../../hooks/useApi';
import { fadeInUp } from '../../utils/animationVariants';

export default function TimetablePage() {
  const { data, loading, error, execute } = useApi(getTimetable);

  useEffect(() => {
    execute();
  }, [execute]);

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
        {!loading && !error && (
          <TimetableCard periods={data?.data ?? []} />
        )}
      </motion.div>
    </Layout>
  );
}
