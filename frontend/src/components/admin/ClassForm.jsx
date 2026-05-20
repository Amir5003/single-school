import { useState } from 'react';

function getDefaultAcademicYear() {
  const now = new Date();
  const year = now.getFullYear();
  // New academic year starts in June
  return now.getMonth() >= 5 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

/**
 * Controlled form for creating or editing a class.
 *
 * Props:
 *   initialData  — class doc for edit mode; null for create
 *   onSubmit     — (formData) => void
 *   loading      — boolean
 *   apiErrors    — { [field]: message }
 */
export default function ClassForm({
  initialData = null,
  onSubmit,
  loading = false,
  apiErrors = {},
}) {
  const [form, setForm] = useState({
    name: initialData?.name ?? '',
    grade: initialData?.grade ?? '',
    section: initialData?.section ?? '',
    academicYear: initialData?.academicYear ?? getDefaultAcademicYear(),
  });

  const [localErrors, setLocalErrors] = useState({});
  const allErrors = { ...localErrors, ...apiErrors };

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Class name is required';
    if (!form.grade.trim()) errs.grade = 'Grade is required';
    if (!form.section.trim()) errs.section = 'Section is required';
    else if (form.section.trim().length > 5) errs.section = 'Section cannot exceed 5 characters';
    if (!form.academicYear.trim()) errs.academicYear = 'Academic year is required';
    setLocalErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      name: form.name.trim(),
      grade: form.grade.trim(),
      section: form.section.trim().toUpperCase(),
      academicYear: form.academicYear.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Name */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Class Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.name}
          onChange={set('name')}
          placeholder="e.g. Grade 5 Morning"
          className={inputCls(allErrors.name)}
        />
        {allErrors.name && <p className="text-xs text-red-600 mt-1">{allErrors.name}</p>}
      </div>

      {/* Grade */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Grade <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.grade}
          onChange={set('grade')}
          placeholder="e.g. 5"
          className={inputCls(allErrors.grade)}
        />
        {allErrors.grade && <p className="text-xs text-red-600 mt-1">{allErrors.grade}</p>}
      </div>

      {/* Section */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Section <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.section}
          onChange={set('section')}
          placeholder="e.g. A"
          maxLength={5}
          className={inputCls(allErrors.section)}
        />
        {allErrors.section && <p className="text-xs text-red-600 mt-1">{allErrors.section}</p>}
      </div>

      {/* Academic Year */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Academic Year <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.academicYear}
          onChange={set('academicYear')}
          placeholder="e.g. 2025-2026"
          className={inputCls(allErrors.academicYear)}
        />
        {allErrors.academicYear && <p className="text-xs text-red-600 mt-1">{allErrors.academicYear}</p>}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
      >
        {loading ? 'Saving…' : initialData ? 'Update Class' : 'Create Class'}
      </button>
    </form>
  );
}

const inputCls = (error) =>
  `w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-indigo-300 ${
    error ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white focus:border-indigo-400'
  }`;
