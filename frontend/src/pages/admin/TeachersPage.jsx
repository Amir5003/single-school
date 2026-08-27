import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from '../../components/common/Layout';
import ConfirmModal from '../../components/common/ConfirmModal';
import StatusMessage from '../../components/common/StatusMessage';
import TeacherForm from '../../components/admin/TeacherForm';
import Avatar from '../../components/common/Avatar';
import {
  getTeachers,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  assignTeacherToClass,
  getClasses,
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-gray-800">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 text-xl leading-none transition"
          >
            ×
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

// ── Assign-to-class modal ─────────────────────────────────────────────────────
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
      setErr(apiErr?.response?.data?.message ?? 'Failed to assign class');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`Assign Class — ${teacher.userId?.name ?? 'Teacher'}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Class <span className="text-red-500">*</span></label>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="">— select class —</option>
            {classes.map((c) => (
              <option key={c._id} value={c._id}>{c.name} (Grade {c.grade}-{c.section})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Subject <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Mathematics"
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {loading ? 'Assigning…' : 'Assign to Class'}
        </button>
      </form>
    </Modal>
  );
}

// ── Teacher row ───────────────────────────────────────────────────────────────

function TeacherRow({ teacher, onEdit, onDelete, onAssign }) {
  const name = teacher.userId?.name ?? '—';
  const email = teacher.userId?.email ?? '—';
  const phone = teacher.userId?.phone;
  const isActive = teacher.userId?.isActive !== false;
  const classCount = teacher.classCount ?? 0;

  return (
    <motion.div
      variants={fadeInUp}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow px-4 py-4 sm:px-5 flex flex-wrap items-center gap-3 xl:flex-nowrap xl:gap-4"
    >
      {/* Identity — shares a line with the class count from sm up; a fixed
          18rem lane on xl so the name is never squeezed by the buttons. */}
      <div className="flex items-center gap-3 min-w-0 basis-full sm:basis-0 sm:grow xl:basis-72 xl:grow-0 xl:shrink-0">
        <Avatar name={name} size="md" />
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 text-sm sm:text-base break-words">{name}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-mono text-indigo-600">{teacher.employeeId}</span>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>

      {/* Teaching load */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 px-2.5 py-1.5">
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <span className="text-sm font-semibold text-gray-800">{classCount}</span>
          <span className="text-xs text-gray-500">{classCount === 1 ? 'Class' : 'Classes'}</span>
        </span>
      </div>

      {/* Contact — the flexible lane, so long emails truncate here, not the
          name. Every level needs min-w-0 or the text overflows the row. */}
      <div className="basis-full min-w-0 flex flex-col gap-1 text-xs text-gray-500 xl:basis-0 xl:grow">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="truncate" title={email}>{email}</span>
        </div>
        {phone && (
          <div className="flex items-center gap-2 min-w-0">
            <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <span className="truncate">{phone}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="basis-full grid grid-cols-2 gap-2 border-t border-gray-50 pt-3 sm:flex sm:flex-wrap sm:items-center xl:basis-auto xl:shrink-0 xl:border-t-0 xl:pt-0">
        <button
          onClick={() => onAssign(teacher)}
          className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold transition whitespace-nowrap"
        >
          Assign Class
        </button>
        <button
          onClick={() => onEdit(teacher)}
          className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs font-semibold transition"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(teacher)}
          aria-label={`Remove ${name}`}
          className="col-span-2 px-3 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs font-semibold transition sm:col-span-1"
        >
          Remove
        </button>
      </div>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TeachersPage() {
  const [teachers, setTeachers] = useState([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [classes, setClasses] = useState([]);
  const [search, setSearch] = useState('');

  const [showFormModal, setShowFormModal] = useState(false);
  const [editTeacher, setEditTeacher] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [apiErrors, setApiErrors] = useState({});

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [assignTarget, setAssignTarget] = useState(null);

  const [status, setStatus] = useState({ message: '', type: 'success' });
  const statusTimer = useRef(null);

  const showStatus = (message, type = 'success') => {
    setStatus({ message, type });
    clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus({ message: '', type: 'success' }), 4000);
  };

  const fetchAll = useCallback(async () => {
    setTableLoading(true);
    try {
      const [teacherRes, classRes] = await Promise.all([getTeachers(), getClasses()]);
      setTeachers(teacherRes.data?.teachers ?? []);
      setClasses(classRes.data?.classes ?? []);
    } catch {
      showStatus('Failed to load data.', 'error');
    } finally {
      setTableLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleFormSubmit = async (formData) => {
    setFormLoading(true);
    setApiErrors({});
    try {
      if (editTeacher) {
        await updateTeacher(editTeacher._id, formData);
        showStatus('Teacher updated successfully.');
      } else {
        await createTeacher(formData);
        showStatus('Teacher added! A temporary password has been emailed to them.');
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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteTeacher(deleteTarget._id);
      showStatus('Teacher removed successfully.');
      setShowDeleteModal(false);
      setDeleteTarget(null);
      fetchAll();
    } catch (err) {
      showStatus(err?.response?.data?.message ?? 'Delete failed.', 'error');
      setShowDeleteModal(false);
    }
  };

  const handleAssign = async (teacherId, data) => {
    await assignTeacherToClass(teacherId, data);
    showStatus('Teacher assigned to class.');
    fetchAll();
  };

  const filtered = teachers.filter((t) => {
    const q = search.toLowerCase();
    return (
      !q ||
      (t.userId?.name ?? '').toLowerCase().includes(q) ||
      (t.userId?.email ?? '').toLowerCase().includes(q) ||
      (t.employeeId ?? '').toLowerCase().includes(q)
    );
  });

  const activeCount = teachers.filter((t) => t.userId?.isActive !== false).length;
  const assignedCount = teachers.filter((t) => (t.classCount ?? 0) > 0).length;

  return (
    <Layout role="school-admin">
      <div className="w-full">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Teachers</h1>
            <p className="text-xs text-gray-400 mt-0.5">Manage staff and class assignments</p>
          </div>
          <button
            onClick={() => { setEditTeacher(null); setApiErrors({}); setShowFormModal(true); }}
            className="flex items-center gap-1.5 shrink-0 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition shadow-sm"
          >
            <span className="text-lg leading-none">+</span> Add Teacher
          </button>
        </div>

        {/* Status */}
        {status.message && (
          <div className="mb-4">
            <StatusMessage message={status.message} type={status.type} />
          </div>
        )}

        {/* Stats bar */}
        {!tableLoading && teachers.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'Total', value: teachers.length, color: 'text-indigo-700 bg-indigo-50' },
              { label: 'Active', value: activeCount, color: 'text-emerald-700 bg-emerald-50' },
              { label: 'Assigned', value: assignedCount, color: 'text-amber-700 bg-amber-50' },
            ].map(({ label, value, color }) => (
              <div key={label} className={`${color} rounded-xl px-4 py-3 text-center`}>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs font-medium mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        {!tableLoading && teachers.length > 0 && (
          <div className="relative mb-4">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7 7 0 103 10a7 7 0 0013.65 6.65z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or employee ID…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
            />
          </div>
        )}

        {/* Content */}
        {tableLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-gray-100 px-4 py-4 sm:px-5 flex items-center gap-3 animate-pulse"
              >
                <div className="w-10 h-10 rounded-full bg-gray-100 shrink-0" />
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
            <div className="text-4xl mb-3">👩‍🏫</div>
            <p className="text-gray-700 font-medium">{search ? 'No teachers match your search' : 'No teachers yet'}</p>
            <p className="text-gray-400 text-sm mt-1">
              {search ? 'Try a different keyword' : 'Click "Add Teacher" to get started'}
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
              {filtered.map((t) => (
                <TeacherRow
                  key={t._id}
                  teacher={t}
                  onEdit={(t) => { setEditTeacher(t); setApiErrors({}); setShowFormModal(true); }}
                  onDelete={(t) => { setDeleteTarget(t); setShowDeleteModal(true); }}
                  onAssign={setAssignTarget}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Create / Edit modal */}
      <AnimatePresence>
        {showFormModal && (
          <Modal
            title={editTeacher ? 'Edit Teacher' : 'Add New Teacher'}
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
      </AnimatePresence>

      {/* Delete confirmation */}
      {showDeleteModal && deleteTarget && (
        <ConfirmModal
          message={`Remove "${deleteTarget.userId?.name ?? 'this teacher'}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onClose={() => { setShowDeleteModal(false); setDeleteTarget(null); }}
        />
      )}

      {/* Assign to class */}
      <AnimatePresence>
        {assignTarget && (
          <AssignClassModal
            teacher={assignTarget}
            classes={classes}
            onAssign={handleAssign}
            onClose={() => setAssignTarget(null)}
          />
        )}
      </AnimatePresence>
    </Layout>
  );
}

