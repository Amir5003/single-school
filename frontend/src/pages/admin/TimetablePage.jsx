import { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '../../components/common/Layout';
import ConfirmModal from '../../components/common/ConfirmModal';
import StatusMessage from '../../components/common/StatusMessage';
import TimetableForm from '../../components/admin/TimetableForm';
import {
  getClasses,
  getTeachers,
  getTimetable,
  createTimetableEntry,
  deleteTimetableEntry,
} from '../../api/admin.api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ── Period card ───────────────────────────────────────────────────────────────

const SUBJECT_COLORS = [
  'bg-indigo-50 text-indigo-700 border-indigo-200',
  'bg-emerald-50 text-emerald-700 border-emerald-200',
  'bg-sky-50 text-sky-700 border-sky-200',
  'bg-violet-50 text-violet-700 border-violet-200',
  'bg-amber-50 text-amber-700 border-amber-200',
  'bg-rose-50 text-rose-700 border-rose-200',
];

function subjectColor(subject) {
  let hash = 0;
  for (let i = 0; i < subject.length; i++) hash = subject.charCodeAt(i) + ((hash << 5) - hash);
  return SUBJECT_COLORS[Math.abs(hash) % SUBJECT_COLORS.length];
}

function PeriodCard({ entry, onDelete }) {
  const color = subjectColor(entry.subject);
  const teacherName =
    entry.teacherId?.userId?.name ?? entry.teacherId?.employeeId ?? '—';

  return (
    <div className={`rounded-xl border p-3 flex flex-col gap-1 ${color}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-sm leading-snug">{entry.subject}</span>
        <button
          onClick={() => onDelete(entry)}
          className="text-current opacity-50 hover:opacity-100 text-base leading-none shrink-0 transition"
          title="Delete period"
        >
          ×
        </button>
      </div>
      <p className="text-xs opacity-70">{teacherName}</p>
      <p className="text-xs font-medium">
        {entry.startTime} – {entry.endTime}
      </p>
    </div>
  );
}

// ── Weekly grid ───────────────────────────────────────────────────────────────

function WeeklyGrid({ entries, onDelete }) {
  const byDay = DAYS.reduce((acc, day) => {
    acc[day] = entries.filter((e) => e.day === day);
    return acc;
  }, {});

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        {/* Header row */}
        <div className="grid grid-cols-7 mb-2">
          <div className="text-xs font-medium text-gray-400 px-2" />
          {DAYS.map((d) => (
            <div
              key={d}
              className="text-xs font-semibold text-gray-500 px-2 py-1 text-center"
            >
              {d.slice(0, 3)}
            </div>
          ))}
        </div>

        {/* Entry rows — one row of cards per day column */}
        {/* We compute the max periods for any day and render that many rows */}
        {(() => {
          const maxRows = Math.max(1, ...DAYS.map((d) => byDay[d].length));
          return Array.from({ length: maxRows }, (_, rowIdx) => (
            <div key={rowIdx} className="grid grid-cols-7 gap-x-2 mb-2 items-start">
              <div className="text-xs text-gray-300 px-2 py-2 text-right">
                {rowIdx === 0 ? 'Periods' : ''}
              </div>
              {DAYS.map((day) => {
                const entry = byDay[day][rowIdx];
                return (
                  <div key={day} className="px-1">
                    {entry ? (
                      <PeriodCard entry={entry} onDelete={onDelete} />
                    ) : null}
                  </div>
                );
              })}
            </div>
          ));
        })()}

        {entries.length === 0 && (
          <p className="col-span-7 text-center text-sm text-gray-400 py-8">
            No periods scheduled. Add one above.
          </p>
        )}
      </div>
    </div>
  );
}

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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TimetablePage() {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [entries, setEntries] = useState([]);
  const [gridLoading, setGridLoading] = useState(false);

  // Form modal
  const [showFormModal, setShowFormModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [conflictError, setConflictError] = useState(null);

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

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

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const [classRes, teacherRes] = await Promise.all([
          getClasses(),
          getTeachers(),
        ]);
        const classList = classRes.data?.classes ?? [];
        setClasses(classList);
        setTeachers(teacherRes.data?.teachers ?? []);
        // Auto-select first class
        if (classList.length > 0) setSelectedClassId(classList[0]._id);
      } catch {
        showStatus('Failed to load data.', 'error');
      }
    };
    bootstrap();
  }, []);

  // ── Fetch timetable for selected class ────────────────────────────────────

  const fetchEntries = useCallback(async (classId) => {
    if (!classId) return;
    setGridLoading(true);
    try {
      const res = await getTimetable(classId);
      setEntries(res.data?.entries ?? []);
    } catch {
      showStatus('Failed to load timetable.', 'error');
    } finally {
      setGridLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries(selectedClassId);
  }, [selectedClassId, fetchEntries]);

  // ── Create entry ──────────────────────────────────────────────────────────

  const handleFormSubmit = async (formData) => {
    setFormLoading(true);
    setConflictError(null);
    try {
      await createTimetableEntry(formData);
      showStatus('Period added successfully.');
      setShowFormModal(false);
      fetchEntries(selectedClassId);
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message;
      if (status === 409) {
        setConflictError(msg ?? 'Time conflict detected.');
        // Keep modal open so user can see the error
      } else {
        showStatus(msg ?? 'Failed to add period.', 'error');
        setShowFormModal(false);
      }
    } finally {
      setFormLoading(false);
    }
  };

  // ── Delete entry ──────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteTimetableEntry(deleteTarget._id);
      showStatus('Period deleted.');
      setShowDeleteModal(false);
      setDeleteTarget(null);
      fetchEntries(selectedClassId);
    } catch {
      showStatus('Delete failed.', 'error');
      setShowDeleteModal(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const selectedClass = classes.find((c) => c._id === selectedClassId);

  return (
    <Layout role="admin">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Timetable</h2>

        <div className="flex items-center gap-3">
          {/* Class selector */}
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
          >
            <option value="">— select class —</option>
            {classes.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} ({c.grade}-{c.section})
              </option>
            ))}
          </select>

          <button
            disabled={!selectedClassId}
            onClick={() => { setConflictError(null); setShowFormModal(true); }}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 transition"
          >
            + Add Period
          </button>
        </div>
      </div>

      {/* Status banner */}
      {status.message && (
        <div className="mb-4">
          <StatusMessage message={status.message} type={status.type} />
        </div>
      )}

      {/* Grid */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        {!selectedClassId ? (
          <p className="text-center text-sm text-gray-400 py-12">
            Select a class to view its timetable.
          </p>
        ) : gridLoading ? (
          <p className="text-center text-sm text-gray-400 py-12">Loading…</p>
        ) : (
          <>
            {selectedClass && (
              <p className="text-xs font-medium text-gray-500 mb-4">
                {selectedClass.name} — Grade {selectedClass.grade}, Section {selectedClass.section}
              </p>
            )}
            <WeeklyGrid
              entries={entries}
              onDelete={(entry) => { setDeleteTarget(entry); setShowDeleteModal(true); }}
            />
          </>
        )}
      </div>

      {/* Add period form modal */}
      {showFormModal && (
        <Modal title="Add Timetable Period" onClose={() => setShowFormModal(false)}>
          <TimetableForm
            classes={classes}
            teachers={teachers}
            onSubmit={handleFormSubmit}
            onClose={() => setShowFormModal(false)}
            loading={formLoading}
            conflictError={conflictError}
          />
        </Modal>
      )}

      {/* Delete confirmation */}
      {showDeleteModal && deleteTarget && (
        <ConfirmModal
          message={`Delete "${deleteTarget.subject}" on ${deleteTarget.day} (${deleteTarget.startTime}–${deleteTarget.endTime})?`}
          onConfirm={handleDelete}
          onClose={() => { setShowDeleteModal(false); setDeleteTarget(null); }}
        />
      )}
    </Layout>
  );
}
