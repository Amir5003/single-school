import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/common/Layout';
import EmptyState from '../../components/common/EmptyState';
import { getClasses } from '../../api/admin.api';
import {
  listFeeConfigs, createFeeConfig, updateFeeConfig, deleteFeeConfig,
  generateFeesFromConfig, listFees, updateFeeStatus,
} from '../../api/fee.api';

const STATUS_LABELS = {
  pending: { label: 'Pending',  bg: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  paid:    { label: 'Paid',     bg: 'bg-green-50  text-green-700  border-green-200'  },
  overdue: { label: 'Overdue',  bg: 'bg-red-50    text-red-700    border-red-200'    },
  exempt:  { label: 'Fee Free', bg: 'bg-blue-50   text-blue-700   border-blue-200'   },
};

const formatDueDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

function StatusBadge({ status }) {
  const s = STATUS_LABELS[status] ?? { label: status, bg: 'bg-gray-100 text-gray-600 border-gray-200' };
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border ${s.bg}`}>
      {s.label}
    </span>
  );
}

// ─── Fee Config Form ──────────────────────────────────────────────────────────
function FeeConfigForm({ classes, onSave, onCancel, initial = null }) {
  const [form, setForm] = useState(
    initial ?? { classId: '', label: '', amount: '', dueDate: '', description: '' }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.classId || !form.label || !form.amount || !form.dueDate) {
      setError('Class, label, amount, and due date are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({ ...form, amount: Number(form.amount) });
    } catch (err) {
      setError(err?.response?.data?.message ?? 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-indigo-100 rounded-2xl shadow-sm p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-800">
        {initial ? 'Edit Fee Config' : 'New Fee Config'}
      </h3>
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Class</label>
          <select
            required
            value={form.classId}
            onChange={(e) => set('classId', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="">Select class…</option>
            {classes.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}{c.section ? ` — ${c.section}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
          <input
            required
            value={form.label}
            onChange={(e) => set('label', e.target.value)}
            maxLength={200}
            placeholder="e.g. Term 1 Tuition Fee"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Amount (₹)</label>
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={(e) => set('amount', e.target.value)}
            placeholder="5000"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Due Date</label>
          <input
            required
            type="date"
            value={form.dueDate ? form.dueDate.slice(0, 10) : ''}
            onChange={(e) => set('dueDate', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Description <span className="text-gray-400">(optional)</span>
          </label>
          <input
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            maxLength={300}
            placeholder="Additional details shown on fee slip"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
          Cancel
        </button>
        <button type="submit" disabled={saving}
          className="px-5 py-2 text-sm rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60 transition">
          {saving ? 'Saving…' : initial ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}

// ─── Fee Config Tab ────────────────────────────────────────────────────────────
function FeeConfigTab({ classes }) {
  const [configs, setConfigs]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [genResult, setGenResult]   = useState({});
  const [genPending, setGenPending] = useState(null);
  const [error, setError]           = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listFeeConfigs();
      setConfigs(res.data?.configs ?? []);
    } catch {
      setError('Failed to load fee configurations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (data) => {
    if (editTarget) {
      await updateFeeConfig(editTarget._id, data);
    } else {
      await createFeeConfig(data);
    }
    setShowForm(false);
    setEditTarget(null);
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this fee config? Existing fee records are not affected.')) return;
    try {
      await deleteFeeConfig(id);
      setConfigs((prev) => prev.filter((c) => c._id !== id));
    } catch {
      setError('Failed to delete.');
    }
  };

  const handleGenerate = async (id) => {
    setGenPending(id);
    try {
      const res = await generateFeesFromConfig(id);
      setGenResult((prev) => ({ ...prev, [id]: res.data }));
    } catch (err) {
      setError(err?.response?.data?.message ?? 'Generation failed.');
    } finally {
      setGenPending(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-gray-500">Define fee amounts per class. Then generate fee records for all enrolled students.</p>
        {!showForm && !editTarget && (
          <button onClick={() => setShowForm(true)}
            className="w-full sm:w-auto px-4 py-2 text-sm rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition whitespace-nowrap flex-shrink-0">
            + New Config
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      {(showForm && !editTarget) && (
        <FeeConfigForm
          classes={classes}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : configs.length === 0 ? (
        <EmptyState title="No fee configs yet" message="Create a class-level fee configuration to get started." />
      ) : (
        <div className="space-y-3">
          {configs.map((cfg) => (
            editTarget?._id === cfg._id ? (
              <FeeConfigForm
                key={cfg._id}
                classes={classes}
                initial={{ ...cfg, classId: cfg.classId?._id ?? cfg.classId,
                  dueDate: cfg.dueDate ? cfg.dueDate.slice(0, 10) : '' }}
                onSave={handleSave}
                onCancel={() => setEditTarget(null)}
              />
            ) : (
              <div key={cfg._id} className="bg-white border border-gray-100 rounded-2xl shadow-sm px-4 sm:px-5 py-4">
                {/* Actions drop to their own row on phones — inline they squeeze
                    the label down to an ellipsis */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-gray-800 truncate">{cfg.label}</p>
                      <span className="sm:hidden text-sm font-semibold text-gray-800 whitespace-nowrap">
                        ₹{cfg.amount.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {cfg.classId?.name ?? '—'}{cfg.classId?.section ? ` · ${cfg.classId.section}` : ''}
                      {' · '}Due {formatDueDate(cfg.dueDate)}
                      <span className="hidden sm:inline"> · ₹{cfg.amount.toLocaleString()}</span>
                    </p>
                    {cfg.description && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{cfg.description}</p>
                    )}
                    {genResult[cfg._id] && (
                      <p className="text-xs text-green-700 mt-1">
                        ✓ {genResult[cfg._id].created} created, {genResult[cfg._id].skipped} already existed
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleGenerate(cfg._id)}
                      disabled={genPending === cfg._id}
                      title="Generate fee records for all class students"
                      className="flex-1 sm:flex-none text-xs px-3 py-2 sm:py-1.5 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 transition whitespace-nowrap"
                    >
                      {genPending === cfg._id ? '…' : '⚡ Generate'}
                    </button>
                    <button onClick={() => setEditTarget(cfg)}
                      className="flex-1 sm:flex-none text-xs px-3 py-2 sm:py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(cfg._id)}
                      className="flex-1 sm:flex-none text-xs px-3 py-2 sm:py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Fee Records Tab ───────────────────────────────────────────────────────────
// Header and rows are separate grids, so every non-flexible column needs a
// fixed width for the two to agree on where a column starts.
const RECORD_GRID = 'md:grid-cols-[minmax(0,1fr)_100px_90px_90px_175px] md:gap-3';

const FILTER_LABEL   = 'block text-xs font-medium text-gray-500 mb-1';
const FILTER_CONTROL = 'w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300';

const STATUS_FILTER_OPTIONS = [
  { value: '',        label: 'All'      },
  { value: 'pending', label: 'Pending'  },
  { value: 'paid',    label: 'Paid'     },
  { value: 'overdue', label: 'Overdue'  },
  { value: 'exempt',  label: 'Fee Free' },
];

function FeeRecordsTab({ classes, configs = [] }) {
  const [fees, setFees]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [classFilter, setClassFilter]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [configFilter, setConfigFilter] = useState('');
  const [dueDateFrom, setDueDateFrom]   = useState('');
  const [dueDateTo, setDueDateTo]       = useState('');
  const [updating, setUpdating] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError]       = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listFees({
        ...(classFilter  && { classId: classFilter }),
        ...(statusFilter && { status: statusFilter }),
        ...(configFilter && { configId: configFilter }),
        ...(dueDateFrom  && { dueDateFrom }),
        ...(dueDateTo    && { dueDateTo }),
        page,
        limit: 30,
      });
      setFees(res.data?.fees ?? []);
      setTotal(res.data?.total ?? 0);
    } catch {
      setError('Failed to load fee records.');
    } finally {
      setLoading(false);
    }
  }, [classFilter, statusFilter, configFilter, dueDateFrom, dueDateTo, page]);

  useEffect(() => { load(); }, [load]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [classFilter, statusFilter, configFilter, dueDateFrom, dueDateTo]);

  const exportToCSV = async () => {
    setExporting(true);
    try {
      const res = await listFees({
        ...(classFilter  && { classId: classFilter }),
        ...(statusFilter && { status: statusFilter }),
        ...(configFilter && { configId: configFilter }),
        ...(dueDateFrom  && { dueDateFrom }),
        ...(dueDateTo    && { dueDateTo }),
        page: 1,
        limit: 9999,
      });
      const rows = res.data?.fees ?? [];
      const headers = ['Student Name', 'Enrollment ID', 'Class', 'Fee Label', 'Amount', 'Due Date', 'Status', 'Paid At'];
      const lines = rows.map((f) => {
        const cls = f.studentId?.classId;
        const clsName = cls ? `${cls.name}${cls.section ? ` - ${cls.section}` : ''}` : '';
        return [
          f.studentId?.userId?.name ?? '',
          f.studentId?.enrollmentId ?? '',
          clsName,
          f.configId?.label ?? f.description ?? '',
          f.amount,
          f.dueDate ? new Date(f.dueDate).toLocaleDateString('en-IN') : '',
          f.status,
          f.paidAt ? new Date(f.paidAt).toLocaleDateString('en-IN') : '',
        ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
      });
      const csv  = [headers.join(','), ...lines].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `fee-records-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleStatusChange = async (feeId, newStatus) => {
    setUpdating(feeId);
    try {
      await updateFeeStatus(feeId, newStatus);
      setFees((prev) => prev.map((f) => f._id === feeId ? { ...f, status: newStatus,
        paidAt: newStatus === 'paid' ? new Date().toISOString() : null } : f));
    } catch {
      setError('Failed to update fee status.');
    } finally {
      setUpdating(null);
    }
  };

  const statusCounts = fees.reduce((acc, f) => {
    acc[f.status] = (acc[f.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(STATUS_LABELS).map(([key, { label, bg }]) => (
          statusCounts[key] != null && (
            <span key={key} className={`text-xs px-3 py-1 rounded-full border font-medium ${bg}`}>
              {label}: {statusCounts[key]}
            </span>
          )
        ))}
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Row 1: dropdowns and date range. Each control carries its own
            label — an empty date input renders as a bare grey box on iOS, so
            without one there is no way to tell what it filters. */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label htmlFor="fee-class-filter" className={FILTER_LABEL}>Class</label>
            <select
              id="fee-class-filter"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className={FILTER_CONTROL}
            >
              <option value="">All Classes</option>
              {classes.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}{c.section ? ` — ${c.section}` : ''}
                </option>
              ))}
            </select>
          </div>

          {configs.length > 0 && (
            <div>
              <label htmlFor="fee-label-filter" className={FILTER_LABEL}>Fee label</label>
              <select
                id="fee-label-filter"
                value={configFilter}
                onChange={(e) => setConfigFilter(e.target.value)}
                className={FILTER_CONTROL}
              >
                <option value="">All Labels</option>
                {configs.map((cfg) => (
                  <option key={cfg._id} value={cfg._id}>{cfg.label}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="fee-due-from" className={FILTER_LABEL}>Due from</label>
            <input
              id="fee-due-from"
              type="date"
              value={dueDateFrom}
              onChange={(e) => setDueDateFrom(e.target.value)}
              className={FILTER_CONTROL}
            />
          </div>
          <div>
            <label htmlFor="fee-due-to" className={FILTER_LABEL}>Due until</label>
            <input
              id="fee-due-to"
              type="date"
              value={dueDateTo}
              onChange={(e) => setDueDateTo(e.target.value)}
              className={FILTER_CONTROL}
            />
          </div>
        </div>

        {/* Row 2: status pills + count + export */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl border border-gray-200 overflow-x-auto scrollbar-hide max-w-full">
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium transition flex-shrink-0 whitespace-nowrap
                  ${statusFilter === opt.value
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <span className="text-xs text-gray-400">{total} record{total !== 1 ? 's' : ''}</span>

          <button
            onClick={exportToCSV}
            disabled={exporting || total === 0}
            className="ml-auto flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition"
          >
            {exporting ? (
              <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
              </svg>
            )}
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : fees.length === 0 ? (
        <EmptyState title="No fee records" message="Generate fees from a fee config, or adjust your filters." />
      ) : (
        <>
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            {/* Table header — hidden below md, where each record is a card.
                Column widths are fixed rather than auto so the header and the
                rows below it (separate grids) actually line up. */}
            <div className={`hidden md:grid ${RECORD_GRID} px-5 py-3 bg-gray-50 border-b border-gray-100
              text-xs font-semibold text-gray-500 uppercase tracking-wide`}>
              <span>Student</span>
              <span>Due Date</span>
              <span>Amount</span>
              <span>Status</span>
              <span>Actions</span>
            </div>

            {fees.map((fee) => {
              const studentName = fee.studentId?.userId?.name ?? 'Unknown';
              const enrollmentId = fee.studentId?.enrollmentId ?? '';
              const cls = fee.studentId?.classId;
              const className = cls ? `${cls.name}${cls.section ? ` — ${cls.section}` : ''}` : '';
              const isUpdating = updating === fee._id;

              return (
                <div key={fee._id}
                  className={`flex flex-col gap-2.5 px-4 py-3.5 border-b border-gray-50 last:border-b-0 hover:bg-gray-50 transition
                    md:grid ${RECORD_GRID} md:items-center md:px-5`}>
                  {/* Student — the amount sits alongside on phones, where there
                      is no separate Amount column to carry it */}
                  <div className="flex items-start justify-between gap-3 min-w-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{studentName}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {enrollmentId}{className ? ` · ${className}` : ''}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 md:hidden">
                        Due {formatDueDate(fee.dueDate)}
                      </p>
                    </div>
                    <span className="md:hidden text-sm font-semibold text-gray-800 whitespace-nowrap">
                      ₹{fee.amount.toLocaleString()}
                    </span>
                  </div>

                  <span className="hidden md:block text-xs text-gray-500 whitespace-nowrap">
                    {formatDueDate(fee.dueDate)}
                  </span>
                  <span className="hidden md:block text-sm font-semibold text-gray-700 whitespace-nowrap">
                    ₹{fee.amount.toLocaleString()}
                  </span>

                  {/* `md:contents` lifts the badge and the buttons into the
                      Status and Actions columns while keeping them one row on
                      phones */}
                  <div className="flex items-center justify-between gap-2 md:contents">
                    <StatusBadge status={fee.status} />

                    <div className="flex items-center gap-1.5">
                      {fee.status !== 'paid' && (
                        <button
                          onClick={() => handleStatusChange(fee._id, 'paid')}
                          disabled={isUpdating}
                          title="Mark as paid"
                          className="text-xs px-2 py-1 rounded-lg border border-green-200 text-green-600 hover:bg-green-50 disabled:opacity-50 transition whitespace-nowrap"
                        >
                          {isUpdating ? '…' : 'Mark paid'}
                        </button>
                      )}
                      {fee.status !== 'exempt' && (
                        <button
                          onClick={() => handleStatusChange(fee._id, 'exempt')}
                          disabled={isUpdating}
                          title="Grant fee exemption"
                          className="text-xs px-2 py-1 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 disabled:opacity-50 transition whitespace-nowrap"
                        >
                          Fee free
                        </button>
                      )}
                      {(fee.status === 'paid' || fee.status === 'exempt') && (
                        <button
                          onClick={() => handleStatusChange(fee._id, 'pending')}
                          disabled={isUpdating}
                          title="Reset to pending"
                          className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition whitespace-nowrap"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {total > 30 && (
            <div className="flex justify-end gap-2">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition">
                Prev
              </button>
              <span className="px-3 py-1.5 text-xs text-gray-500">Page {page}</span>
              <button disabled={fees.length < 30} onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition">
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FeesPage() {
  const [tab, setTab]           = useState('configs');
  const [classes, setClasses]   = useState([]);
  const [configs, setConfigs]   = useState([]);

  useEffect(() => {
    getClasses().then((res) => setClasses(res.data?.classes ?? [])).catch(() => {});
    listFeeConfigs().then((res) => setConfigs(res.data?.configs ?? [])).catch(() => {});
  }, []);

  return (
    <Layout role="school-admin">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Fees</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure class-wise fee amounts and track payment status for all students.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-xl border border-gray-200 overflow-hidden w-fit">
          {[
            { key: 'configs', label: 'Fee Setup' },
            { key: 'records', label: 'Fee Records' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-5 py-2 text-sm font-medium transition
                ${tab === key ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'configs'
          ? <FeeConfigTab classes={classes} />
          : <FeeRecordsTab classes={classes} configs={configs} />}
      </div>
    </Layout>
  );
}
