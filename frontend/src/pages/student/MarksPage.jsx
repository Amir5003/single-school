import { useEffect } from 'react';
import { motion } from 'framer-motion';
import Layout from '../../components/common/Layout';
import CourseworkList from '../../components/student/CourseworkList';
import EmptyState from '../../components/common/EmptyState';
import { getCoursework } from '../../api/student.api';
import useApi from '../../hooks/useApi';
import { fadeInUp } from '../../utils/animationVariants';

export default function CourseworkPage() {
  const { data, loading, error, execute } = useApi(getCoursework);

  useEffect(() => {
    execute();
  }, [execute]);

  const subjects = data?.data?.subjects ?? [];

  return (
    <Layout role="student">
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="max-w-3xl"
      >
        <h1 className="text-2xl font-bold text-gray-900 mb-1">My Coursework</h1>
        <p className="text-sm text-gray-500 mb-6">
          Class tests, quizzes, assignments, projects and practicals, grouped by subject.
          Term exam results appear under Report Cards.
        </p>

        {loading && <p className="text-gray-500 text-sm">Loading coursework…</p>}
        {error && <p className="text-red-500 text-sm">{error}</p>}

        {!loading && !error && (
          subjects.length === 0 ? (
            <EmptyState message="No coursework recorded yet" />
          ) : (
            <CourseworkList
              subjects={subjects}
              overallPercentage={data?.data?.overallPercentage ?? 0}
              totalCount={data?.data?.totalCount ?? 0}
            />
          )
        )}
      </motion.div>
    </Layout>
  );
}
