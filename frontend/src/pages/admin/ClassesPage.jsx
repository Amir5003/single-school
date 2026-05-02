import { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '../../components/common/Layout';
import ConfirmModal from '../../components/common/ConfirmModal';
import StatusMessage from '../../components/common/StatusMessage';
import ClassForm from '../../components/admin/ClassForm';
import {
  getClasses,
  createClass,
  updateClass,
  deleteClass,
  getStudents,
  assignStudents,
  assignTeacherToClass,
  getTeachers,
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
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Assign Students modal ─────────────────────────────────────────────────────

function AssignStudentsModal({ cls, students, onAssign, onClose }) {
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');

  const toggle = (id) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    return (
      (s.userId?.name ?? '').toLowerCase().includes(q) ||
      (s.enrollmentId ?? '').toLowerCase().includes(q)
    );
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selected.length === 0) { setErr('Select at least one student'); return; }
    setErr('');
    setLoading(true);
    try {
      await onAssign(cls._id, selected);
      onClose();
    } catch (apiErr) {
      setErr(apiErr?.response?.data?.message ?? 'Assignment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`Assign Students — ${cls.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search students…"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
        />

        <div className="max-h-52 overflow-y-auto divide-y divide-gray-50 border border-gray-100 rounded-lg">
          {filtered.length === 0 ? (
            <p className="text-xs text-gray-400 p-3 text-center">No unassigned students found.</p>
          ) : (
            filtered.map((s) => (
              <label
                key={s._id}
                className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(s._id)}
                  onChange={() => toggle(s._id)}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">
                  {s.userId?.name ?? '—'}{' '}
                  <span className="text-gray-400 text-xs">({s.enrollmentId})</span>
                </span>
              </label>
            ))
          )}
        </div>

        {selected.length > 0 && (
          <p className="text-xs text-indigo-600 font-medium">{selected.length} selected</p>
        )}
        {err && <p className="text-xs text-red-600">{err}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {loading ? 'Assigning…' : 'Assign Students'}
        </button>
      </form>
    </Modal>
  );
}

// ── Assign Teacher modal ──────────────────────────────────────────────────────

function AssignTeacherModal({ cls, teachers, onAssign, onClose }) {
  const [teacherId, setTeacherId] = useState('');
  const [subject, setSubject] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!teacherId) { setErr('Select a teacher'); return; }
    if (!subject.trim()) { setErr('Subject is required'); return; }
    setErr('');
    setLoading(true);
    try {
      await onAssign(teacherId, { classId: cls._id, subject: subject.trim() });
      onClose();
    } catch (apiErr) {
      setErr(apiErr?.response?.data?.message ?? 'Assignment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`Assign Teacher — ${cls.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Teacher <span className="text-red-500">*</span>
          </label>
          <select
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="">— select teacher —</option>
            {teachers.map((t) => (
              <option key={t._id} value={t._id}>
                {t.userId?.name ?? t.employeeId} ({t.employeeId})
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
          {loading ? 'Assigning…' : 'Assign Teacher'}
        </button>
      </form>
    </Modal>
  );
}

// ── Class card ────────────────────────────────────────────────────────────────

function ClassCard({ cls, onEdit, onDelete, onAssignStudents, onAssignTeacher }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-800 text-base">{cls.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Grade {cls.grade} — Section {cls.section}
          </p>
        </div>
        <span className="inline-block bg-sky-50 text-sky-700 text-xs font-medium px-2 py-0.5 rounded-full">
          {cls.grade}-{cls.section}
        </span>
      </div>

      {/* Counts */}
      <div className="flex gap-3">
        <span className="text-xs text-gray-500">
          <span className="font-semibold text-gray-700">{cls.studentCount ?? 0}</span> Students
        </span>
        <span className="text-xs text-gray-400">·</span>
        <span className="text-xs text-gray-500">
          <span className="font-semibold text-gray-700">{cls.teacherCount ?? 0}</span> Teachers
        </span>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-50">
        <button
          onClick={() => onAssignStudents(cls)}
          className="text-xs px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-medium transition"
        >
          + Students
        </button>
        <button
          onClick={() => onAssignTeacher(cls)}
          className="text-xs px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium transition"
        >
          + Teacher
        </button>
        <button
          onClick={() => onEdit(cls)}
          className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium transition"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(cls)}
          className="text-xs px-2.5 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium transition"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ClassesPage() {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [unassignedStudents, setUnassignedStudents] = useState([]);
  const [tableLoading, setTableLoading] = useState(false);

  // Form modal
  const [showFormModal, setShowFormModal] = useState(false);
  const [editClass, setEditClass] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [apiErrors, setApiErrors] = useState({});

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Assign modals
  const [assignStudentTarget, setAssignStudentTarget] = useState(null);
  const [assignTeacherTarget, setAssignTeacherTarget] = useState(null);

  // Status
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
      const [classRes, teacherRes, studentRes] = await Promise.all([
        getClasses(),
        getTeachers(),
        getStudents({ page: 1, limit: 200 }),
      ]);
      setClasses(classRes.data?.classes ?? []);
      setTeachers(teacherRes.data?.teachers ?? []);
      // Only show students without a class assignment
      const all = studentRes.data?.students ?? [];
      setUnassignedStudents(all.filter((s) => !s.classId));
    } catch {
      showStatus('Failed to load data.', 'error');
    } finally {
      setTableLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── CRUD ───────────────────────────────────────────────────────────────────

  const handleFormSubmit = async (formData) => {
    setFormLoading(true);
    setApiErrors({});
    try {
      if (editClass) {
        await updateClass(editClass._id, formData);
        showStatus('Class updated successfully.');
      } else {
        await createClass(formData);
        showStatus('Class created successfully.');
      }
      setShowFormModal(false);
      setEditClass(null);
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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteClass(deleteTarget._id);
      showStatus('Class deleted successfully.');
      setShowDeleteModal(false);
      setDeleteTarget(null);
      fetchAll();
    } catch (err) {
      showStatus(err?.response?.data?.message ?? 'Delete failed.', 'error');
      setShowDeleteModal(false);
    }
  };

  const handleAssignStudents = async (classId, studentIds) => {
    await assignStudents(classId, studentIds);
    showStatus('Students assigned successfully.');
    fetchAll();
  };

  const handleAssignTeacher = async (teacherId, data) => {
    await assignTeacherToClass(teacherId, data);
    showStatus('Teacher assigned successfully.');
    fetchAll();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Layout role="admin">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Classes</h2>
        <button
          onClick={() => { setEditClass(null); setApiErrors({}); setShowFormModal(true); }}
          className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition"
        >
          + Add Class
        </button>
      </div>

      {/* Status */}
      {status.message && (
        <div className="mb-4">
          <StatusMessage message={status.message} type={status.type} />
        </div>
      )}

      {/* Grid */}
      {tableLoading ? (
        <div className="py-16 text-center text-sm text-gray-400">Loading…</div>
      ) : classes.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-400">
          No classes yet. Create one above.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls) => (
            <ClassCard
              key={cls._id}
              cls={cls}
              onEdit={(c) => { setEditClass(c); setApiErrors({}); setShowFormModal(true); }}
              onDelete={(c) => { setDeleteTarget(c); setShowDeleteModal(true); }}
              onAssignStudents={(c) => setAssignStudentTarget(c)}
              onAssignTeacher={(c) => setAssignTeacherTarget(c)}
            />
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      {showFormModal && (
        <Modal
          title={editClass ? 'Edit Class' : 'Add Class'}
          onClose={() => { setShowFormModal(false); setEditClass(null); }}
        >
          <ClassForm
            initialData={editClass}
            onSubmit={handleFormSubmit}
            loading={formLoading}
            apiErrors={apiErrors}
          />
        </Modal>
      )}

      {/* Delete confirmation */}
      {showDeleteModal && deleteTarget && (
        <ConfirmModal
          message={`Delete "${deleteTarget.name}"? Students in this class will be unassigned.`}
          onConfirm={handleDelete}
          onClose={() => { setShowDeleteModal(false); setDeleteTarget(null); }}
        />
      )}

      {/* Assign students modal */}
      {assignStudentTarget && (
        <AssignStudentsModal
          cls={assignStudentTarget}
          students={unassignedStudents}
          onAssign={handleAssignStudents}
          onClose={() => setAssignStudentTarget(null)}
        />
      )}

      {/* Assign teacher modal */}
      {assignTeacherTarget && (
        <AssignTeacherModal
          cls={assignTeacherTarget}
          teachers={teachers}
          onAssign={handleAssignTeacher}
          onClose={() => setAssignTeacherTarget(null)}
        />
      )}
    </Layout>
  );
}
