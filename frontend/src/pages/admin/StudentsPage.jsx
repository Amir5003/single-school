import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from '../../components/common/Layout';
import Pagination from '../../components/common/Pagination';
import ConfirmModal from '../../components/common/ConfirmModal';
import StatusMessage from '../../components/common/StatusMessage';
import Avatar from '../../components/common/Avatar';
import StudentForm from '../../components/admin/StudentForm';
import {
  getStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  getClasses,
} from '../../api/admin.api';
import { fadeInUp, staggerContainer } from '../../utils/animationVariants';

const DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function classLabel(cls) {
  if (!cls) return null;
  return `${cls.name}${cls.section ? ` – ${cls.section}` : ''}`;
}

// ── Student row ───────────────────────────────────────────────────────────────

function StudentRow({ student, onEdit, onDelete }) {
  const name = student.userId?.name ?? '—';
  const cls = classLabel(student.classId);

  return (
    <motion.div
      variants={fadeInUp}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow px-4 py-4 sm:px-5 flex flex-wrap items-center gap-3 xl:flex-nowrap xl:gap-4"
    >
      {/* Identity — fixed 18rem lane on xl so the name is never squeezed */}
      <div className="flex items-center gap-3 min-w-0 basis-full sm:basis-0 sm:grow xl:basis-72 xl:grow-0 xl:shrink-0">
        <Avatar name={name} size="md" />
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 text-sm sm:text-base break-words">{name}</p>
          <p className="text-xs font-mono text-indigo-600 mt-1">{student.enrollmentId}</p>
        </div>
      </div>

      {/* Class */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {cls ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 px-2.5 py-1.5">
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            </svg>
            <span className="text-sm font-semibold text-gray-800">{cls}</span>
          </span>
        ) : (
          <span className="inline-flex items-center rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700">
            No class assigned
          </span>
        )}
      </div>

      {/* Meta — the flexible lane */}
      <div className="basis-full min-w-0 flex items-center gap-2 text-xs text-gray-500 xl:basis-0 xl:grow">
        <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="truncate">Added {formatDate(student.createdAt)}</span>
      </div>

      {/* Actions */}
      <div className="basis-full grid grid-cols-2 gap-2 border-t border-gray-50 pt-3 sm:flex sm:flex-wrap sm:items-center xl:basis-auto xl:shrink-0 xl:border-t-0 xl:pt-0">
        <button
          onClick={() => onEdit(student)}
          className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs font-semibold transition"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(student)}
          aria-label={`Delete ${name}`}
          className="px-3 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs font-semibold transition"
        >
          Delete
        </button>
      </div>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function StudentsPage() {
  // ── List state ─────────────────────────────────────────────────────────────
  const [students, setStudents] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);          // matches the active filters
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [classes, setClasses] = useState([]);
  const [tableLoading, setTableLoading] = useState(false);

  // ── Form modal state ───────────────────────────────────────────────────────
  const [showFormModal, setShowFormModal] = useState(false);
  const [editStudent, setEditStudent] = useState(null); // null = create mode
  const [formLoading, setFormLoading] = useState(false);
  const [apiErrors, setApiErrors] = useState({});

  // ── Delete modal state ─────────────────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // ── Status banner ──────────────────────────────────────────────────────────
  const [status, setStatus] = useState({ message: '', type: 'success' });
  const statusTimer = useRef(null);

  const showStatus = (message, type = 'success') => {
    setStatus({ message, type });
    clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus({ message: '', type: 'success' }), 4000);
  };

  // ── Data fetching ──────────────────────────────────────────────────────────

  // The class filter is applied server-side — the list is paginated, so
  // filtering client-side would only ever narrow the current page.
  const fetchStudents = useCallback(
    async (currentPage = 1, currentSearch = '', currentClass = '') => {
      setTableLoading(true);
      try {
        const result = await getStudents({
          page: currentPage,
          limit: PAGE_SIZE,
          search: currentSearch,
          classId: currentClass,
        });
        setStudents(result.data.students || []);
        setTotalPages(result.data.totalPages || 1);
        setPage(result.data.page || 1);
        setTotal(result.data.total ?? 0);
      } catch {
        showStatus('Failed to load students. Please try again.', 'error');
      } finally {
        setTableLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchStudents(1, '', '');
    getClasses()
      .then((res) => setClasses(res.data?.classes ?? []))
      .catch(() => showStatus('Failed to load classes for the filter.', 'error'));
  }, [fetchStudents]);

  // Debounced search
  const searchTimer = useRef(null);
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      fetchStudents(1, val, classFilter);
    }, DEBOUNCE_MS);
  };

  const handleClassFilterChange = (e) => {
    const val = e.target.value;
    setClassFilter(val);
    fetchStudents(1, search, val); // back to page 1 — page 3 of the old set is meaningless
  };

  const clearFilters = () => {
    setSearch('');
    setClassFilter('');
    clearTimeout(searchTimer.current);
    fetchStudents(1, '', '');
  };

  const handlePageChange = (newPage) => fetchStudents(newPage, search, classFilter);

  const refresh = () => fetchStudents(page, search, classFilter);

  // ── Modal helpers ──────────────────────────────────────────────────────────
  const openCreateModal = () => {
    setEditStudent(null);
    setApiErrors({});
    setShowFormModal(true);
  };

  const openEditModal = (student) => {
    setEditStudent(student);
    setApiErrors({});
    setShowFormModal(true);
  };

  const closeFormModal = () => {
    setShowFormModal(false);
    setApiErrors({});
  };

  // ── Form submit ────────────────────────────────────────────────────────────
  const handleFormSubmit = async (formData) => {
    setFormLoading(true);
    setApiErrors({});
    try {
      if (editStudent) {
        await updateStudent(editStudent._id, formData);
        showStatus('Student updated successfully.', 'success');
      } else {
        await createStudent(formData);
        showStatus('Student created successfully.', 'success');
      }
      closeFormModal();
      refresh();
    } catch (err) {
      const httpStatus = err.response?.status;
      if (httpStatus === 422) {
        const mapped = {};
        err.response.data.errors?.forEach(({ field, msg }) => {
          mapped[field] = msg;
        });
        setApiErrors(mapped);
      } else if (httpStatus === 409) {
        // Keep the modal open; surface the conflict message inside as a status
        setApiErrors({ _form: err.response.data.message });
      } else {
        closeFormModal();
        showStatus('Something went wrong. Please try again.', 'error');
      }
    } finally {
      setFormLoading(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const openDeleteModal = (student) => {
    setDeleteTarget(student);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    setShowDeleteModal(false);
    try {
      await deleteStudent(deleteTarget._id);
      showStatus('Student deleted successfully.', 'success');
      refresh();
    } catch (err) {
      const msg =
        err.response?.status === 400
          ? err.response.data.message
          : 'Failed to delete student. Please try again.';
      showStatus(msg, 'error');
    }
    setDeleteTarget(null);
  };

  const filtersActive = Boolean(search || classFilter);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Layout role="school-admin">
      <div className="w-full">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Students</h1>
            <p className="text-xs text-gray-400 mt-0.5">Manage student accounts and records</p>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 shrink-0 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition shadow-sm"
          >
            <span className="text-lg leading-none">+</span> Add Student
          </button>
        </div>

        {/* Status */}
        {status.message && (
          <div className="mb-4">
            <StatusMessage message={status.message} type={status.type} />
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1 min-w-0">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7 7 0 103 10a7 7 0 0013.65 6.65z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={handleSearchChange}
              placeholder="Search by name or enrollment ID…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
            />
          </div>

          <select
            value={classFilter}
            onChange={handleClassFilterChange}
            aria-label="Filter by class"
            className="sm:w-56 shrink-0 px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-indigo-300 bg-white text-gray-700"
          >
            <option value="">All classes</option>
            <option value="unassigned">No class assigned</option>
            {classes.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} (Grade {c.grade}-{c.section})
              </option>
            ))}
          </select>

          {filtersActive && (
            <button
              onClick={clearFilters}
              className="shrink-0 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
            >
              Clear
            </button>
          )}
        </div>

        {/* Result count */}
        {!tableLoading && total > 0 && (
          <p className="text-xs text-gray-400 mb-3">
            {filtersActive
              ? `${total} ${total === 1 ? 'student' : 'students'} match your filters`
              : `${total} ${total === 1 ? 'student' : 'students'} total`}
          </p>
        )}

        {/* List */}
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
                <div className="hidden sm:block h-8 w-40 bg-gray-100 rounded-lg" />
              </div>
            ))}
          </div>
        ) : students.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
            <div className="text-4xl mb-3">🎓</div>
            <p className="text-gray-700 font-medium">
              {filtersActive ? 'No students match your filters' : 'No students yet'}
            </p>
            <p className="text-gray-400 text-sm mt-1">
              {filtersActive
                ? 'Try a different name, enrollment ID, or class'
                : 'Click "Add Student" to get started'}
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
              {students.map((s) => (
                <StudentRow
                  key={s._id}
                  student={s}
                  onEdit={openEditModal}
                  onDelete={openDeleteModal}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Pagination */}
        <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
      </div>

      {/* StudentForm modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">
                {editStudent ? 'Edit Student' : 'Add New Student'}
              </h2>
              <button
                onClick={closeFormModal}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Inline 409 / generic form-level error */}
            {apiErrors._form && <StatusMessage message={apiErrors._form} type="error" />}

            <div className={apiErrors._form ? 'mt-4' : ''}>
              <StudentForm
                initialData={editStudent}
                onSubmit={handleFormSubmit}
                loading={formLoading}
                classes={classes}
                apiErrors={
                  // Don't pass _form key into individual field errors
                  Object.fromEntries(
                    Object.entries(apiErrors).filter(([k]) => k !== '_form')
                  )
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* ConfirmModal for delete */}
      {showDeleteModal && deleteTarget && (
        <ConfirmModal
          message={`Are you sure you want to delete "${deleteTarget.userId?.name ?? 'this student'}" (${deleteTarget.enrollmentId})? This action cannot be undone.`}
          onConfirm={handleDeleteConfirm}
          onClose={() => {
            setShowDeleteModal(false);
            setDeleteTarget(null);
          }}
        />
      )}
    </Layout>
  );
}
