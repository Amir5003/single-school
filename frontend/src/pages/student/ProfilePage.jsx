import { useEffect } from 'react';
import { motion } from 'framer-motion';
import Layout from '../../components/common/Layout';
import ProfileCard from '../../components/student/ProfileCard';
import { getProfile } from '../../api/student.api';
import useApi from '../../hooks/useApi';
import { fadeInUp } from '../../utils/animationVariants';

export default function ProfilePage() {
  const { data, loading, error, execute } = useApi(getProfile);

  useEffect(() => {
    execute();
  }, [execute]);

  return (
    <Layout role="student">
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="max-w-2xl"
      >
        <h1 className="text-2xl font-bold text-gray-900 mb-6">My Profile</h1>

        {loading && (
          <p className="text-gray-500 text-sm">Loading profile…</p>
        )}
        {error && (
          <p className="text-red-500 text-sm">{error}</p>
        )}
        {!loading && !error && data && (
          <ProfileCard profile={data.data} />
        )}
      </motion.div>
    </Layout>
  );
}
