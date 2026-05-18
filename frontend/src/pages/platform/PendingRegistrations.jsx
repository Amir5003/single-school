import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  listPendingRegistrations,
  approveRegistration,
  rejectRegistration,
} from '../../api/platform.api';
import { staggerContainer, fadeInUp } from '../../utils/animationVariants';
import PlatformLayout from '../../components/common/PlatformLayout';

function RejectModal({ user, onConfirm, onCancel }) {
  const [remark, setRemark] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm(user._id, remark);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md"
      >
        <h2 className="text-lg font-bold text-gray-900 mb-1">Reject Registration</h2>
        <p className="text-sm text-gray-500 mb-4">
          Rejecting <span className="font-medium text-gray-700">{user.schoolId?.name || '—'}</span>{' '}
          ({user.email})
        </p>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Remark <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          rows={3}
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          placeholder="Reason for rejection…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-400 resize-none"
        />
        <div className="mt-4 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition disabled:opacity-50"
          >
            {loading ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function PendingRegistrations() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rejectTarget, setRejectTarget] = useState(null);
  const [actionMsg, setActionMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listPendingRegistrations();
      setUsers(res.data?.users ?? []);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load pending registrations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (userId) => {
    try {
      await approveRegistration(userId);
      setActionMsg('Registration approved successfully.');
      setUsers((prev) => prev.filter((u) => u._id !== userId));
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to approve registration');
    }
  };

  const handleRejectConfirm = async (userId, remark) => {
    try {
      await rejectRegistration(userId, remark);
      setActionMsg('Registration rejected.');
      setUsers((prev) => prev.filter((u) => u._id !== userId));
      setRejectTarget(null);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to reject registration');
      setRejectTarget(null);
    }
  };

  return (
    <PlatformLayout>
    <div className="p-6 max-w-5xl mx-auto">
      {rejectTarget && (
        <RejectModal
          user={rejectTarget}
          onConfirm={handleRejectConfirm}
          onCancel={() => setRejectTarget(null)}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pending Registrations</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            New school registration requests awaiting approval
          </p>
        </div>
        <Link
          to="/platform/schools"
          className="text-sm text-blue-600 hover:underline"
        >
          ← All Schools
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}
      {actionMsg && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 flex justify-between">
          {actionMsg}
          <button onClick={() => setActionMsg('')} className="text-green-500 hover:text-green-700 text-xs">✕</button>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : users.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🎉</p>
          <p className="font-medium">No pending registrations</p>
          <p className="text-sm mt-1">All caught up!</p>
        </div>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="space-y-4"
        >
          <AnimatePresence>
            {users.map((user) => (
              <motion.div
                key={user._id}
                variants={fadeInUp}
                exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
                className="bg-white rounded-xl border border-gray-200 p-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h2 className="font-semibold text-gray-900 text-base">
                        {user.schoolId?.name || 'Unknown School'}
                      </h2>
                      {user.schoolId?.slug && (
                        <span className="text-xs font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                          {user.schoolId.slug}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{user.email}</p>
                    {user.phone && (
                      <p className="text-sm text-gray-500">{user.phone}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Registered{' '}
                      {new Date(user.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleApprove(user._id)}
                      className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => setRejectTarget(user)}
                      className="px-4 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium transition border border-red-200"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
    </PlatformLayout>
  );
}
