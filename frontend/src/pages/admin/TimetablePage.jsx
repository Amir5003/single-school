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
const DAY_ABBR = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat' };

const JS_DAY_MAP = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const SUBJECT_COLORS = [
  { bar: 'bg-indigo-500', bg: 'bg-indigo-50', text: 'text-indigo-700', badge: 'bg-indigo-100 text-indigo-600' },
  { bar: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-600' },
  { bar: 'bg-sky-500', bg: 'bg-sky-50', text: 'text-sky-700', badge: 'bg-sky-100 text-sky-600' },
  { bar: 'bg-violet-500', bg: 'bg-violet-50', text: 'text-violet-700', badge: 'bg-violet-100 text-violet-600' },
  { bar: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-600' },
  { bar: 'bg-rose-500', bg: 'bg-rose-50', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-600' },
];

function subjectColor(subject) {
  let hash = 0;
  for (let i = 0; i < subject.length; i++) hash = subject.charCodeAt(i) + ((hash << 5) - hash);
  return SUBJECT_COLORS[Math.abs(hash) % SUBJECT_COLORS.length];
}

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ── Period card ───────────────────────────────────────────────────────────────

function PeriodCard({ entry, onDelete }) {
  const color = subjectColor(entry.subject);
  const teacherName = entry.teacherId?.userId?.name ?? entry.teacherId?.employeeId ?? '—';

  return (
    <div className={`flex items-stretch rounded-xl overflow-hidden border border-gray-100 shadow-sm ${color.bg}`}>
      {/* Left accent bar */}
      <div className={`w-1 shrink-0 ${color.bar}`} />

      {/* Content */}
      <div className="flex-1 flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className={`font-semibold text-sm leading-tight truncate ${color.text}`}>
            {entry.subject}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{teacherName}</p>
          <div className="flex items-center gap-1 mt-1.5">
            <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
            </svg>
            <span className="text-xs text-gray-500 font-medium">
              {formatTime(entry.startTime)} – {formatTime(entry.endTime)}
            </span>
          </div>
        </div>

        <button
          onClick={() => onDelete(entry)}
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
          title="Delete period"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Day tab strip ─────────────────────────────────────────────────────────────

function DayTabs({ activeDay, onChange, entryCounts }) {
  const activeRef = useRef(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' });
  }, [activeDay]);

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
      {DAYS.map((day) => {
        const isActive = day === activeDay;
        const count = entryCounts[day] ?? 0;
        return (
          <button
            key={day}
            ref={isActive ? activeRef : null}
            onClick={() => onChange(day)}
            className={`flex-none flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              isActive
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            <span>{DAY_ABBR[day]}</span>
            {count > 0 && (
              <span className={`text-[10px] font-bold leading-none ${isActive ? 'text-indigo-200' : 'text-gray-400'}`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Day view ──────────────────────────────────────────────────────────────────

function DayView({ day, entries, onDelete, onAddClick }) {
  const sorted = [...entries].sort((a, b) => a.startTime.localeCompare(b.startTime));

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 gap-3">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-gray-500">No periods on {day}</p>
          <p className="text-xs text-gray-400 mt-0.5">Tap "+ Add Period" to schedule one</p>
        </div>
        <button
          onClick={onAddClick}
          className="mt-1 px-4 py-2 rounded-xl bg-indigo-50 text-indigo-600 text-sm font-semibold hover:bg-indigo-100 transition"
        >
          + Add Period
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {sorted.map((entry) => (
        <PeriodCard key={entry._id} entry={entry} onDelete={onDelete} />
      ))}
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TimetablePage() {
  const todayName = JS_DAY_MAP[new Date().getDay()];
  const defaultDay = DAYS.includes(todayName) ? todayName : 'Monday';

  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [entries, setEntries] = useState([]);
  const [activeDay, setActiveDay] = useState(defaultDay);
  const [gridLoading, setGridLoading] = useState(false);

  const [showFormModal, setShowFormModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [conflictError, setConflictError] = useState(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

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

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const [classRes, teacherRes] = await Promise.all([getClasses(), getTeachers()]);
        const classList = classRes.data?.classes ?? [];
        setClasses(classList);
        setTeachers(teacherRes.data?.teachers ?? []);
        if (classList.length > 0) setSelectedClassId(classList[0]._id);
      } catch {
        showStatus('Failed to load data.', 'error');
      }
    };
    bootstrap();
  }, []);

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

  useEffect(() => { fetchEntries(selectedClassId); }, [selectedClassId, fetchEntries]);

  const handleFormSubmit = async (formData) => {
    setFormLoading(true);
    setConflictError(null);
    try {
      await createTimetableEntry(formData);
      showStatus('Period added successfully.');
      setShowFormModal(false);
      fetchEntries(selectedClassId);
    } catch (err) {
      const code = err?.response?.status;
      const msg = err?.response?.data?.message;
      if (code === 409) {
        setConflictError(msg ?? 'Time conflict detected.');
      } else {
        showStatus(msg ?? 'Failed to add period.', 'error');
        setShowFormModal(false);
      }
    } finally {
      setFormLoading(false);
    }
  };

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

  const selectedClass = classes.find((c) => c._id === selectedClassId);

  const entryCounts = DAYS.reduce((acc, day) => {
    acc[day] = entries.filter((e) => e.day === day).length;
    return acc;
  }, {});

  const dayEntries = entries.filter((e) => e.day === activeDay);

  const openAddModal = () => { setConflictError(null); setShowFormModal(true); };

  return (
    <Layout role="school-admin">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <h2 className="text-xl font-semibold text-gray-800">Timetable</h2>
        <button
          disabled={!selectedClassId}
          onClick={openAddModal}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 transition shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Period
        </button>
      </div>

      {/* Class selector */}
      <div className="mb-4">
        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300 bg-white text-gray-700"
        >
          <option value="">— select class —</option>
          {classes.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name} ({c.grade}-{c.section})
            </option>
          ))}
        </select>
      </div>

      {/* Status banner */}
      {status.message && (
        <div className="mb-4">
          <StatusMessage message={status.message} type={status.type} />
        </div>
      )}

      {/* Timetable card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {!selectedClassId ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <svg className="w-10 h-10 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
            </svg>
            <p className="text-sm text-gray-400">Select a class to view its timetable</p>
          </div>
        ) : gridLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="text-sm">Loading timetable…</span>
          </div>
        ) : (
          <>
            {/* Class label + period count */}
            {selectedClass && (
              <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-50">
                <div>
                  <p className="text-sm font-semibold text-gray-700">{selectedClass.name}</p>
                  <p className="text-xs text-gray-400">Grade {selectedClass.grade} · Section {selectedClass.section}</p>
                </div>
                <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                  {entries.length} {entries.length === 1 ? 'period' : 'periods'}
                </span>
              </div>
            )}

            {/* Day tabs */}
            <div className="px-4 pt-4 pb-3 border-b border-gray-50">
              <DayTabs activeDay={activeDay} onChange={setActiveDay} entryCounts={entryCounts} />
            </div>

            {/* Period list for active day */}
            <div className="px-4 py-4">
              <DayView
                day={activeDay}
                entries={dayEntries}
                onDelete={(entry) => { setDeleteTarget(entry); setShowDeleteModal(true); }}
                onAddClick={openAddModal}
              />
            </div>
          </>
        )}
      </div>

      {/* Add period modal — slides up from bottom on mobile */}
      {showFormModal && (
        <Modal title="Add Period" onClose={() => setShowFormModal(false)}>
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
