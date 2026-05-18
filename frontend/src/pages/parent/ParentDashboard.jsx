import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getChildren } from '../../api/parent.api';
import { staggerContainer, fadeInUp } from '../../utils/animationVariants';

export default function ParentDashboard() {
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getChildren()
      .then((res) => setChildren(res.data.children || []))
      .catch((e) => setError(e.response?.data?.message || 'Failed to load children'))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return <div className="p-6 text-gray-400">Loading your children…</div>;
  if (error)
    return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Children</h1>

      {children.length === 0 ? (
        <p className="text-gray-500">No children linked to your account yet.</p>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {children.map((child) => {
            if (!child) return null;
            const name = child.userId?.name || 'Student';
            const email = child.userId?.email || '';
            return (
              <motion.div
                key={child._id}
                variants={fadeInUp}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg">
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{name}</p>
                    <p className="text-xs text-gray-500">{email}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-500 mb-1">
                  Enrollment: <span className="font-mono text-gray-700">{child.enrollmentId}</span>
                </p>
                <Link
                  to={`/parent/children/${child._id}`}
                  className="mt-3 block text-center text-sm font-medium text-blue-600 border border-blue-200 rounded-lg py-1.5 hover:bg-blue-50 transition-colors"
                >
                  View Details →
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
