import { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '../../components/common/Layout';
import ConfirmModal from '../../components/common/ConfirmModal';
import StatusMessage from '../../components/common/StatusMessage';
import TeacherForm from '../../components/admin/TeacherForm';
import {
  getTeachers,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  assignTeacherToClass,
  getClasses,
} from '../../api/admin.api';

// ── Modal shell ───────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }) {
  const handleKey = useCallback(
    (e) => { if (e.key === 'Escape') onClose(); },
    [onClose]
  );
  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 mt-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-800">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Assign-to-class panel (mini modal) ────────────────────────────────────────

function AssignClassModal({ teacher, classes, onAssign, onClose }) {
  const [classId, setClassId] = useState('');
  const [subject, setSubject] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!classId) { setErr('Select a class'); return; }
    if (!subject.trim()) { setErr('Subject is required'); return; }
    setErr('');
    setLoading(true);
    try {
      await onAssign(teacher._id, { classId, subject: subject.trim() });
      onClose();
    } catch (apiErr) {
      const msg = apiErr?.response?.data?.message;
      setErr(msg ?? 'Failed to assign class');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={`Assign Class — ${teacher.userId?.name ?? 'Teacher'}`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Class <span className="text-red-500">*</span>
          </label>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="">— select class —</option>
            {classes.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} ({c.grade}-{c.section})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Subject <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Mathematics"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

        {err && <p className="text-xs text-red-600">{err}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {loading ? 'Assigning…' : 'Assign'}
        </button>
      </form>
    </Modal>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TeachersPage() {
  const [teachers, setTeachers] = useState([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [classes, setClasses] = useState([]);

  // Form modal
  const [showFormModal, setShowFormModal] = useState(false);
  const [editTeacher, setEditTeacher] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [apiErrors, setApiErrors] = useState({});

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Assign modal
  const [assignTarget, setAssignTarget] = useState(null);

  // Status banner
  const [status, setStatus] = useState({ message: '', type: 'success' });
  const statusTimer = useRef(null);

  const showStatus = (message, type = 'success') => {
    setStatus({ message, type });
    clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(
      () => setStatus({ message: '', type: 'success' }),
      4000
    );
  };

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setTableLoading(true);
    try {
      const [teacherRes, classRes] = await Promise.all([
        getTeachers(),
        getClasses(),
      ]);
      setTeachers(teacherRes.data?.teachers ?? []);
      setClasses(classRes.data?.classes ?? []);
    } catch {
      showStatus('Failed to load data.', 'error');
    } finally {
      setTableLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Create / Update ────────────────────────────────────────────────────────

  const handleFormSubmit = async (formData) => {
    setFormLoading(true);
    setApiErrors({});
    try {
      if (editTeacher) {
        await updateTeacher(editTeacher._id, formData);
        showStatus('Teacher updated successfully.');
      } else {
        await createTeacher(formData);
        showStatus('Teacher created successfully.');
      }
      setShowFormModal(false);
      setEditTeacher(null);
      fetchAll();
    } catch (err) {
      const data = err?.response?.data;
      if (data?.errors) {
        const mapped = {};
        data.errors.forEach(({ field, msg }) => { mapped[field] = msg; });
        setApiErrors(mapped);
      } else {
        showStatus(data?.message ?? 'An error occurred.', 'error');
        setShowFormModal(false);
      }
    } finally {
      setFormLoading(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteTeacher(deleteTarget._id);
      showStatus('Teacher deleted successfully.');
      setShowDeleteModal(false);
      setDeleteTarget(null);
      fetchAll();
    } catch (err) {
      const msg = err?.response?.data?.message ?? 'Delete failed.';
      showStatus(msg, 'error');
      setShowDeleteModal(false);
    }
  };

  // ── Assign ─────────────────────────────────────────────────────────────────

  const handleAssign = async (teacherId, data) => {
    await assignTeacherToClass(teacherId, data);
    showStatus('Teacher assigned to class.');
    fetchAll();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Layout role="school-admin">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Teachers</h2>
        <button
          onClick={() => { setEditTeacher(null); setApiErrors({}); setShowFormModal(true); }}
          className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition"
        >
          + Add Teacher
        </button>
      </div>

      {/* Status banner */}
      {status.message && (
        <div className="mb-4">
          <StatusMessage message={status.message} type={status.type} />
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {tableLoading ? (
          <div className="py-16 text-center text-sm text-gray-400">Loading…</div>
        ) : teachers.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">
            No teachers yet. Add one above.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Employee ID</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Classes</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {teachers.map((t) => (
                <tr key={t._id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {t.userId?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                    {t.employeeId}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{t.userId?.email ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-block bg-indigo-50 text-indigo-700 text-xs font-medium px-2 py-0.5 rounded-full">
                      {t.classCount ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => { setAssignTarget(t); }}
                        className="text-xs px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium transition"
                      >
                        Assign Class
                      </button>
                      <button
                        onClick={() => {
                          setEditTeacher(t);
                          setApiErrors({});
                          setShowFormModal(true);
                        }}
                        className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => { setDeleteTarget(t); setShowDeleteModal(true); }}
                        className="text-xs px-2.5 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium transition"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Edit modal */}
      {showFormModal && (
        <Modal
          title={editTeacher ? 'Edit Teacher' : 'Add Teacher'}
          onClose={() => { setShowFormModal(false); setEditTeacher(null); }}
        >
          <TeacherForm
            initialData={editTeacher}
            onSubmit={handleFormSubmit}
            loading={formLoading}
            apiErrors={apiErrors}
          />
        </Modal>
      )}

      {/* Delete confirmation */}
      {showDeleteModal && deleteTarget && (
        <ConfirmModal
          message={`Delete "${deleteTarget.userId?.name ?? 'this teacher'}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onClose={() => { setShowDeleteModal(false); setDeleteTarget(null); }}
        />
      )}

      {/* Assign to class */}
      {assignTarget && (
        <AssignClassModal
          teacher={assignTarget}
          classes={classes}
          onAssign={handleAssign}
          onClose={() => setAssignTarget(null)}
        />
      )}
    </Layout>
  );
}
