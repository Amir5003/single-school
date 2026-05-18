import { useState, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import Layout from '../../components/common/Layout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { showToast } from '../../redux/slices/uiSlice';
import { getPendingUsers, approveUser, rejectUser } from '../../api/admin.api';

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const ROLE_BADGE = {
  student: 'bg-blue-100 text-blue-700',
  teacher: 'bg-green-100 text-green-700',
  admin: 'bg-purple-100 text-purple-700',
};

export default function PendingUsersPage() {
  const dispatch = useDispatch();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null); // userId being actioned
  const statusTimer = useRef(null);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const result = await getPendingUsers();
      setUsers(result.data.users);
    } catch {
      dispatch(showToast({ message: 'Failed to load pending users', type: 'error' }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
    return () => clearTimeout(statusTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApprove = async (user) => {
    setActionLoading(user._id);
    try {
      await approveUser(user._id);
      dispatch(showToast({ message: `${user.name} approved successfully`, type: 'success' }));
      setUsers((prev) => prev.filter((u) => u._id !== user._id));
    } catch {
      dispatch(showToast({ message: 'Failed to approve user', type: 'error' }));
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (user) => {
    setActionLoading(user._id);
    try {
      await rejectUser(user._id);
      dispatch(showToast({ message: `${user.name} rejected`, type: 'success' }));
      setUsers((prev) => prev.filter((u) => u._id !== user._id));
    } catch {
      dispatch(showToast({ message: 'Failed to reject user', type: 'error' }));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Layout role="school-admin">
      <div className="p-6">
        <h1 className="text-xl font-bold text-gray-800 mb-6">Pending Approvals</h1>

        {loading ? (
          <LoadingSpinner />
        ) : users.length === 0 ? (
          <EmptyState message="No pending registrations — all caught up!" />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Role</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Registered</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
                  <tr key={user._id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium text-gray-800">{user.name}</td>
                    <td className="px-4 py-3 text-gray-600">{user.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                          ROLE_BADGE[user.role] || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(user.createdAt)}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => handleApprove(user)}
                        disabled={actionLoading === user._id}
                        className="rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 transition"
                      >
                        {actionLoading === user._id ? '…' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleReject(user)}
                        disabled={actionLoading === user._id}
                        className="rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 transition"
                      >
                        {actionLoading === user._id ? '…' : 'Reject'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
