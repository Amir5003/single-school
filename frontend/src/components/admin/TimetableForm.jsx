import { useState } from 'react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Form overlay for creating or editing a timetable entry.
 *
 * Props:
 *   initialData — entry doc for edit; null for create
 *   classes     — [{ _id, name, grade, section }]
 *   teachers    — [{ _id, userId: { name }, employeeId }]
 *   onSubmit    — (formData) => Promise<void>
 *   onClose     — () => void
 *   loading     — boolean
 *   conflictError — string | null — 409 conflict message to show inline
 */
export default function TimetableForm({
  initialData = null,
  classes = [],
  teachers = [],
  onSubmit,
  onClose,
  loading = false,
  conflictError = null,
}) {
  const isEdit = !!initialData;

  const [form, setForm] = useState({
    classId: initialData?.classId?._id ?? initialData?.classId ?? '',
    teacherId: initialData?.teacherId?._id ?? initialData?.teacherId ?? '',
    subject: initialData?.subject ?? '',
    day: initialData?.day ?? '',
    startTime: initialData?.startTime ?? '',
    endTime: initialData?.endTime ?? '',
  });

  const [localErrors, setLocalErrors] = useState({});

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.classId) errs.classId = 'Class is required';
    if (!form.teacherId) errs.teacherId = 'Teacher is required';
    if (!form.subject.trim()) errs.subject = 'Subject is required';
    if (!form.day) errs.day = 'Day is required';
    if (!form.startTime) errs.startTime = 'Start time is required';
    else if (!TIME_REGEX.test(form.startTime)) errs.startTime = 'Use HH:MM format (e.g. 08:30)';
    if (!form.endTime) errs.endTime = 'End time is required';
    else if (!TIME_REGEX.test(form.endTime)) errs.endTime = 'Use HH:MM format (e.g. 09:30)';
    else if (form.startTime && form.endTime && form.endTime <= form.startTime) {
      errs.endTime = 'End time must be after start time';
    }
    setLocalErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    await onSubmit({
      classId: form.classId,
      teacherId: form.teacherId,
      subject: form.subject.trim(),
      day: form.day,
      startTime: form.startTime,
      endTime: form.endTime,
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Class selector */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Class <span className="text-red-500">*</span>
        </label>
        <select value={form.classId} onChange={set('classId')} className={selectCls(localErrors.classId)}>
          <option value="">— select class —</option>
          {classes.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name} ({c.grade}-{c.section})
            </option>
          ))}
        </select>
        {localErrors.classId && <p className="text-xs text-red-600 mt-1">{localErrors.classId}</p>}
      </div>

      {/* Teacher selector */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Teacher <span className="text-red-500">*</span>
        </label>
        <select value={form.teacherId} onChange={set('teacherId')} className={selectCls(localErrors.teacherId)}>
          <option value="">— select teacher —</option>
          {teachers.map((t) => (
            <option key={t._id} value={t._id}>
              {t.userId?.name ?? t.employeeId} ({t.employeeId})
            </option>
          ))}
        </select>
        {localErrors.teacherId && <p className="text-xs text-red-600 mt-1">{localErrors.teacherId}</p>}
      </div>

      {/* Subject */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Subject <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.subject}
          onChange={set('subject')}
          placeholder="e.g. Mathematics"
          className={inputCls(localErrors.subject)}
        />
        {localErrors.subject && <p className="text-xs text-red-600 mt-1">{localErrors.subject}</p>}
      </div>

      {/* Day */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Day <span className="text-red-500">*</span>
        </label>
        <select value={form.day} onChange={set('day')} className={selectCls(localErrors.day)}>
          <option value="">— select day —</option>
          {DAYS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        {localErrors.day && <p className="text-xs text-red-600 mt-1">{localErrors.day}</p>}
      </div>

      {/* Time */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Start Time <span className="text-red-500">*</span>
          </label>
          <input
            type="time"
            value={form.startTime}
            onChange={set('startTime')}
            className={inputCls(localErrors.startTime)}
          />
          {localErrors.startTime && <p className="text-xs text-red-600 mt-1">{localErrors.startTime}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            End Time <span className="text-red-500">*</span>
          </label>
          <input
            type="time"
            value={form.endTime}
            onChange={set('endTime')}
            className={inputCls(localErrors.endTime)}
          />
          {localErrors.endTime && <p className="text-xs text-red-600 mt-1">{localErrors.endTime}</p>}
        </div>
      </div>

      {/* 409 conflict error */}
      {conflictError && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700 font-medium">
          ⚠ {conflictError}
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {loading ? 'Saving…' : isEdit ? 'Update Period' : 'Add Period'}
        </button>
      </div>
    </form>
  );
}

const selectCls = (error) =>
  `w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-indigo-300 bg-white ${
    error ? 'border-red-400' : 'border-gray-200 focus:border-indigo-400'
  }`;

const inputCls = (error) =>
  `w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-indigo-300 ${
    error ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white focus:border-indigo-400'
  }`;
