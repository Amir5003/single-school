import { useEffect } from 'react';
import { motion } from 'framer-motion';
import Layout from '../../components/common/Layout';
import AnnouncementList from '../../components/student/AnnouncementCard';
import EmptyState from '../../components/common/EmptyState';
import { getStudentAnnouncements } from '../../api/student.api';
import useApi from '../../hooks/useApi';
import { fadeInUp } from '../../utils/animationVariants';

export default function StudentAnnouncementsPage() {
  const { data, loading, error, execute } = useApi(getStudentAnnouncements);

  useEffect(() => {
    execute();
  }, [execute]);

  const announcements = data?.data?.announcements ?? [];

  return (
    <Layout role="student">
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="max-w-2xl"
      >
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Announcements</h1>

        {loading && (
          <p className="text-gray-500 text-sm">Loading announcements…</p>
        )}
        {error && (
          <p className="text-red-500 text-sm">{error}</p>
        )}
        {!loading && !error && announcements.length === 0 && (
          <EmptyState
            title="No announcements yet"
            message="Your teachers will post updates and notices here."
          />
        )}
        {!loading && !error && announcements.length > 0 && (
          <AnnouncementList announcements={announcements} />
        )}
      </motion.div>
    </Layout>
  );
}
