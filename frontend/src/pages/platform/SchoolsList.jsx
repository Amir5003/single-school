import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { listSchools, activateSchool, deactivateSchool } from '../../api/platform.api';
import { staggerContainer, fadeInUp } from '../../utils/animationVariants';
import PlatformLayout from '../../components/common/PlatformLayout';

const PLAN_BADGE = {
  free: 'bg-gray-100 text-gray-700',
  standard: 'bg-blue-100 text-blue-700',
  premium: 'bg-purple-100 text-purple-700',
};

export default function SchoolsList() {
  const [schools, setSchools] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listSchools({ page, limit: 20, search: search || undefined });
      setSchools(res.data.schools);
      setTotal(res.data.total);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load schools');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (school) => {
    try {
      if (school.isActive) {
        await deactivateSchool(school._id);
      } else {
        await activateSchool(school._id);
      }
      load();
    } catch (e) {
      setError(e.response?.data?.message || 'Action failed');
    }
  };

  return (
    <PlatformLayout>
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Schools</h1>
        <div className="flex items-center gap-4">
          <Link
            to="/platform/pending"
            className="text-sm text-indigo-600 hover:underline font-medium"
          >
            Pending Registrations
          </Link>
          <span className="text-sm text-gray-500">{total} total</span>
        </div>
      </div>

      <input
        type="text"
        placeholder="Search by name or slug…"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        className="mb-4 w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {error && <p className="text-red-600 mb-4 text-sm">{error}</p>}

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="overflow-x-auto rounded-lg border border-gray-200"
        >
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Slug</th>
                <th className="px-4 py-3 text-left">Plan</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <AnimatePresence>
              <tbody className="divide-y divide-gray-100">
                {schools.map((school) => (
                  <motion.tr
                    key={school._id}
                    variants={fadeInUp}
                    className="bg-white hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <Link
                        to={`/platform/schools/${school._id}`}
                        className="hover:text-blue-600 hover:underline"
                      >
                        {school.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono">{school.slug}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_BADGE[school.plan] || PLAN_BADGE.free}`}>
                        {school.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${school.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {school.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggle(school)}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${school.isActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                      >
                        {school.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </motion.tr>
                ))}
                {schools.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                      No schools found.
                    </td>
                  </tr>
                )}
              </tbody>
            </AnimatePresence>
          </table>
        </motion.div>
      )}

      {total > 20 && (
        <div className="mt-4 flex gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 text-sm border rounded disabled:opacity-40"
          >
            Prev
          </button>
          <span className="px-2 py-1 text-sm text-gray-600">Page {page}</span>
          <button
            disabled={schools.length < 20}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 text-sm border rounded disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
    </PlatformLayout>
  );
}
