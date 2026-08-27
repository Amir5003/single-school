import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { fadeInUp, staggerContainer } from '../../utils/animationVariants';

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

// ── Class row ─────────────────────────────────────────────────────────────────

const GRADE_TONES = [
  'bg-indigo-50 text-indigo-700',
  'bg-emerald-50 text-emerald-700',
  'bg-amber-50 text-amber-700',
  'bg-rose-50 text-rose-700',
  'bg-sky-50 text-sky-700',
  'bg-violet-50 text-violet-700',
];

function GradeTile({ grade, section }) {
  const tone = GRADE_TONES[(Number(grade) || 0) % GRADE_TONES.length];
  return (
    <div
      className={`${tone} w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-2xl flex flex-col items-center justify-center leading-none select-none`}
    >
      <span className="text-lg sm:text-xl font-bold">{grade}</span>
      <span className="text-[10px] font-semibold opacity-70 mt-0.5">{section}</span>
    </div>
  );
}

function Stat({ value, label, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 px-2.5 py-1.5">
      <span className="text-gray-400">{children}</span>
      <span className="text-sm font-semibold text-gray-800">{value}</span>
      <span className="text-xs text-gray-500">{label}</span>
    </span>
  );
}

function ClassRow({ cls, onEdit, onDelete, onAssignStudents, onAssignTeacher }) {
  const students = cls.studentCount ?? 0;
  const teachers = cls.teacherCount ?? 0;

  return (
    <motion.div
      variants={fadeInUp}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow px-4 py-4 sm:px-5 flex flex-wrap items-center gap-3 xl:flex-nowrap xl:gap-4"
    >
      {/* Identity — shares a line with the stats from sm up; a fixed 16rem
          lane on xl so the class name is never squeezed by the buttons. */}
      <div className="flex items-center gap-3 min-w-0 basis-full sm:basis-0 sm:grow xl:basis-64 xl:grow-0 xl:shrink-0">
        <GradeTile grade={cls.grade} section={cls.section} />
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm sm:text-base break-words">{cls.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Grade {cls.grade} · Section {cls.section}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <Stat value={students} label={students === 1 ? 'Student' : 'Students'}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-1a4 4 0 00-3-3.87M9 20H4v-1a4 4 0 013-3.87m10-3.63a4 4 0 10-6 0M17 8a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Stat>
        <Stat value={teachers} label={teachers === 1 ? 'Teacher' : 'Teachers'}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
          </svg>
        </Stat>
      </div>

      {/* Spacer pushes actions to the right edge on xl */}
      <div className="hidden xl:block xl:grow" />

      {/* Actions */}
      <div className="basis-full grid grid-cols-2 gap-2 border-t border-gray-50 pt-3 sm:flex sm:flex-wrap sm:items-center xl:basis-auto xl:shrink-0 xl:border-t-0 xl:pt-0">
        <button
          onClick={() => onAssignStudents(cls)}
          className="px-3 py-2 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold transition whitespace-nowrap"
        >
          + Students
        </button>
        <button
          onClick={() => onAssignTeacher(cls)}
          className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold transition whitespace-nowrap"
        >
          + Teacher
        </button>
        <button
          onClick={() => onEdit(cls)}
          className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs font-semibold transition"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(cls)}
          aria-label={`Delete ${cls.name}`}
          className="px-3 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs font-semibold transition"
        >
          Delete
        </button>
      </div>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ClassesPage() {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [unassignedStudents, setUnassignedStudents] = useState([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [search, setSearch] = useState('');

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

  // ── Search ─────────────────────────────────────────────────────────────────

  // Matches class name, grade, section, and the combined "1-A" / "1A" forms so
  // admins can type whatever label they have in their head.
  const filtered = classes.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const grade = String(c.grade ?? '').toLowerCase();
    const section = String(c.section ?? '').toLowerCase();
    return (
      (c.name ?? '').toLowerCase().includes(q) ||
      grade === q ||
      section === q ||
      `${grade}-${section}`.includes(q) ||
      `${grade}${section}`.includes(q)
    );
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Layout role="school-admin">
      <div className="w-full">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Classes</h1>
            <p className="text-xs text-gray-400 mt-0.5">Manage sections, students and subject teachers</p>
          </div>
          <button
            onClick={() => { setEditClass(null); setApiErrors({}); setShowFormModal(true); }}
            className="flex items-center gap-1.5 shrink-0 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition shadow-sm"
          >
            <span className="text-lg leading-none">+</span> Add Class
          </button>
        </div>

        {/* Status */}
        {status.message && (
          <div className="mb-4">
            <StatusMessage message={status.message} type={status.type} />
          </div>
        )}

        {/* Search */}
        {!tableLoading && classes.length > 0 && (
          <div className="relative mb-4">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7 7 0 103 10a7 7 0 0013.65 6.65z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by class name, grade, or section…"
              className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
              >
                ×
              </button>
            )}
          </div>
        )}

        {/* List */}
        {tableLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-gray-100 px-4 py-4 sm:px-5 flex items-center gap-3 animate-pulse"
              >
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gray-100 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/4" />
                </div>
                <div className="hidden sm:block h-8 w-48 bg-gray-100 rounded-lg" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
            <div className="text-4xl mb-3">🏫</div>
            <p className="text-gray-700 font-medium">
              {search ? 'No classes match your search' : 'No classes yet'}
            </p>
            <p className="text-gray-400 text-sm mt-1">
              {search ? 'Try a different name, grade, or section' : 'Click "Add Class" to create your first section'}
            </p>
          </div>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="flex flex-col gap-3"
          >
            <AnimatePresence>
              {filtered.map((cls) => (
                <ClassRow
                  key={cls._id}
                  cls={cls}
                  onEdit={(c) => { setEditClass(c); setApiErrors({}); setShowFormModal(true); }}
                  onDelete={(c) => { setDeleteTarget(c); setShowDeleteModal(true); }}
                  onAssignStudents={(c) => setAssignStudentTarget(c)}
                  onAssignTeacher={(c) => setAssignTeacherTarget(c)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

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
