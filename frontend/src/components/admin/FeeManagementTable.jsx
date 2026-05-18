import { useState, useCallback, useEffect } from 'react';
import { createFee, listFees, markFeePaid } from '../../api/fee.api';

const STATUS_OPTIONS = ['', 'pending', 'paid', 'overdue'];

const FeeManagementTable = () => {
  const [fees, setFees] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ studentId: '', amount: '', description: '', dueDate: '' });
  const [error, setError] = useState('');

  const fetchFees = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (statusFilter) params.status = statusFilter;
      const res = await listFees(params);
      setFees(res.data?.fees ?? []);
      setTotal(res.data?.total ?? 0);
    } catch {
      // handled via empty state
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchFees(); }, [fetchFees]);

  const handleMarkPaid = async (feeId) => {
    try {
      await markFeePaid(feeId);
      fetchFees();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to mark paid.');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await createFee({ ...form, amount: parseFloat(form.amount) });
      setForm({ studentId: '', amount: '', description: '', dueDate: '' });
      setShowCreate(false);
      fetchFees();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to create fee.');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Fee Management</h2>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="bg-[var(--school-primary,#4F46E5)] text-white px-4 py-2 rounded-lg text-sm hover:opacity-90"
        >
          {showCreate ? 'Cancel' : '+ New Fee'}
        </button>
      </div>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-gray-50 rounded-lg p-4 mb-4 grid grid-cols-2 gap-3">
          <input
            className="col-span-2 border rounded px-3 py-2 text-sm"
            placeholder="Student ID"
            value={form.studentId}
            onChange={(e) => setForm({ ...form, studentId: e.target.value })}
            required
          />
          <input
            className="border rounded px-3 py-2 text-sm"
            type="number"
            min="0"
            step="0.01"
            placeholder="Amount"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
          />
          <input
            className="border rounded px-3 py-2 text-sm"
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            required
          />
          <input
            className="col-span-2 border rounded px-3 py-2 text-sm"
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
          />
          <button
            type="submit"
            className="col-span-2 bg-green-600 text-white rounded py-2 text-sm hover:bg-green-700"
          >
            Create Fee
          </button>
        </form>
      )}

      <div className="flex items-center gap-3 mb-3">
        <label className="text-sm text-gray-600">Filter by status:</label>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border rounded px-2 py-1 text-sm"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s || 'All'}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                {['Description', 'Amount', 'Due Date', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-gray-600 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-gray-400 py-6">No fees found.</td>
                </tr>
              ) : (
                fees.map((fee) => (
                  <tr key={fee._id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2">{fee.description}</td>
                    <td className="px-4 py-2">₹{fee.amount}</td>
                    <td className="px-4 py-2">{new Date(fee.dueDate).toLocaleDateString()}</td>
                    <td className="px-4 py-2 capitalize">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          fee.status === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : fee.status === 'overdue'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {fee.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {fee.status !== 'paid' && (
                        <button
                          onClick={() => handleMarkPaid(fee._id)}
                          className="text-xs text-green-700 border border-green-400 rounded px-2 py-0.5 hover:bg-green-50"
                        >
                          Mark Paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {total > 10 && (
        <div className="flex justify-between items-center mt-3 text-sm">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 border rounded disabled:opacity-40"
          >
            Prev
          </button>
          <span>Page {page} of {Math.ceil(total / 10)}</span>
          <button
            disabled={page * 10 >= total}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 border rounded disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default FeeManagementTable;
