import { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '../../components/common/Layout';
import Pagination from '../../components/common/Pagination';
import ConfirmModal from '../../components/common/ConfirmModal';
import StatusMessage from '../../components/common/StatusMessage';
import StudentForm from '../../components/admin/StudentForm';
import {
  getStudents,
  createStudent,
  updateStudent,
  deleteStudent,
} from '../../api/admin.api';

const DEBOUNCE_MS = 300;

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function StudentsPage() {
  // ── Table state ─────────────────────────────────────────────────────────────
  const [students, setStudents] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [tableLoading, setTableLoading] = useState(false);

  // ── Form modal state ─────────────────────────────────────────────────────────
  const [showFormModal, setShowFormModal] = useState(false);
  const [editStudent, setEditStudent] = useState(null); // null = create mode
  const [formLoading, setFormLoading] = useState(false);
  const [apiErrors, setApiErrors] = useState({});

  // ── Delete modal state ───────────────────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // ── Status banner ────────────────────────────────────────────────────────────
  const [status, setStatus] = useState({ message: '', type: 'success' });
  const statusTimer = useRef(null);

  const showStatus = (message, type = 'success') => {
    setStatus({ message, type });
    clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus({ message: '', type: 'success' }), 4000);
  };

  // ── Data fetching ────────────────────────────────────────────────────────────
  const fetchStudents = useCallback(
    async (currentPage = page, currentSearch = search) => {
      setTableLoading(true);
      try {
        const result = await getStudents({
          page: currentPage,
          limit: 20,
          search: currentSearch,
        });
        setStudents(result.data.students || []);
        setTotalPages(result.data.totalPages || 1);
        setPage(result.data.page || 1);
      } catch {
        showStatus('Failed to load students. Please try again.', 'error');
      } finally {
        setTableLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Initial load
  useEffect(() => {
    fetchStudents(1, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search
  const searchTimer = useRef(null);
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      fetchStudents(1, val);
    }, DEBOUNCE_MS);
  };

  const handlePageChange = (newPage) => {
    fetchStudents(newPage, search);
  };

  // ── Modal helpers ────────────────────────────────────────────────────────────
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

  // ── Form submit ──────────────────────────────────────────────────────────────
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
      fetchStudents(page, search);
    } catch (err) {
      const status = err.response?.status;
      if (status === 422) {
        const mapped = {};
        err.response.data.errors?.forEach(({ field, msg }) => {
          mapped[field] = msg;
        });
        setApiErrors(mapped);
      } else if (status === 409) {
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

  // ── Delete ───────────────────────────────────────────────────────────────────
  const openDeleteModal = (student) => {
    setDeleteTarget(student);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    setShowDeleteModal(false);
    try {
      await deleteStudent(deleteTarget._id);
      showStatus('Student deleted successfully.', 'success');
      fetchStudents(page, search);
    } catch (err) {
      const msg =
        err.response?.status === 400
          ? err.response.data.message
          : 'Failed to delete student. Please try again.';
      showStatus(msg, 'error');
    }
    setDeleteTarget(null);
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <Layout role="school-admin">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Students</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage student accounts and records.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition"
        >
          + Add Student
        </button>
      </div>

      {/* Status banner */}
      <StatusMessage message={status.message} type={status.type} />

      {/* Search */}
      <div className="mt-4 mb-3">
        <input
          type="text"
          value={search}
          onChange={handleSearchChange}
          placeholder="Search by name or enrollment ID…"
          className="w-full max-w-sm rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-left text-xs text-gray-500 uppercase font-semibold tracking-wide">
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Enrollment ID</th>
              <th className="px-5 py-3">Class</th>
              <th className="px-5 py-3">Added</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tableLoading ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            ) : students.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                  {search ? 'No students match your search.' : 'No students yet. Add your first student.'}
                </td>
              </tr>
            ) : (
              students.map((s) => (
                <tr
                  key={s._id}
                  className="border-b border-gray-50 hover:bg-gray-50 transition"
                >
                  <td className="px-5 py-3 font-medium text-gray-800">
                    {s.userId?.name ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-gray-600 font-mono text-xs">
                    {s.enrollmentId}
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    {s.classId ? `${s.classId.name}${s.classId.section ? ' – ' + s.classId.section : ''}` : '—'}
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {formatDate(s.createdAt)}
                  </td>
                  <td className="px-5 py-3 text-right space-x-2">
                    <button
                      onClick={() => openEditModal(s)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => openDeleteModal(s)}
                      className="text-xs font-medium text-red-500 hover:text-red-700 transition"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />

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
            {apiErrors._form && (
              <StatusMessage message={apiErrors._form} type="error" />
            )}

            <div className={apiErrors._form ? 'mt-4' : ''}>
              <StudentForm
                initialData={editStudent}
                onSubmit={handleFormSubmit}
                loading={formLoading}
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
