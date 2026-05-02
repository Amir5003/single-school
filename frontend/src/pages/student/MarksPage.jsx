import { useEffect } from 'react';
import { motion } from 'framer-motion';
import Layout from '../../components/common/Layout';
import MarksCardList from '../../components/student/MarksCard';
import EmptyState from '../../components/common/EmptyState';
import { getMarks } from '../../api/student.api';
import useApi from '../../hooks/useApi';
import { fadeInUp } from '../../utils/animationVariants';

export default function MarksPage() {
  const { data, loading, error, execute } = useApi(getMarks);

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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">My Marks</h1>

        {loading && (
          <p className="text-gray-500 text-sm">Loading marks…</p>
        )}
        {error && (
          <p className="text-red-500 text-sm">{error}</p>
        )}
        {!loading && !error && (data?.data?.marks?.length === 0 ? (
          <EmptyState message="Marks not yet available" />
        ) : (
          <MarksCardList
            marks={data?.data?.marks ?? []}
            overallPercentage={data?.data?.overallPercentage ?? 0}
          />
        ))}
      </motion.div>
    </Layout>
  );
}
