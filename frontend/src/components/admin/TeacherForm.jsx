import { useState } from 'react';

const PASSWORD_REGEX = /(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}/;
const EMPLOYEE_ID_REGEX = /^[A-Z0-9-]+$/;

/**
 * Reusable controlled form for creating or editing a teacher.
 *
 * Props:
 *   initialData  — teacher doc (populated) for edit mode; null for create
 *   onSubmit     — (formData: object) => void
 *   loading      — boolean
 *   apiErrors    — { [field]: message } — 422 errors from API
 */
export default function TeacherForm({
  initialData = null,
  onSubmit,
  loading = false,
  apiErrors = {},
}) {
  const isEdit = !!initialData;

  const [form, setForm] = useState({
    name: initialData?.userId?.name ?? '',
    email: initialData?.userId?.email ?? '',
    password: '',
    phone: initialData?.userId?.phone ?? '',
    employeeId: initialData?.employeeId ?? '',
  });

  const [localErrors, setLocalErrors] = useState({});
  const allErrors = { ...localErrors, ...apiErrors };

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!isEdit) {
      if (!form.email.trim()) errs.email = 'Email is required';
      if (!form.password) {
        errs.password = 'Password is required';
      } else if (!PASSWORD_REGEX.test(form.password)) {
        errs.password = 'Must be 8+ chars with 1 uppercase, 1 digit, and 1 special character';
      }
      if (!form.employeeId.trim()) errs.employeeId = 'Employee ID is required';
    }
    if (
      form.employeeId.trim() &&
      !EMPLOYEE_ID_REGEX.test(form.employeeId.trim().toUpperCase())
    ) {
      errs.employeeId = 'Use uppercase letters, digits, and hyphens only (e.g. TCH-001)';
    }
    setLocalErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    const payload = {
      ...form,
      employeeId: form.employeeId.trim().toUpperCase(),
    };
    if (isEdit) {
      delete payload.email;
      delete payload.password;
    }
    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Name */}
      <Field label="Full Name" error={allErrors.name} required>
        <input
          type="text"
          value={form.name}
          onChange={set('name')}
          placeholder="e.g. Mr Ahmed Ali"
          className={inputCls(allErrors.name)}
        />
      </Field>

      {/* Email — create only */}
      {!isEdit && (
        <Field label="Email" error={allErrors.email} required>
          <input
            type="email"
            value={form.email}
            onChange={set('email')}
            placeholder="teacher@school.com"
            className={inputCls(allErrors.email)}
          />
        </Field>
      )}

      {/* Password — create only */}
      {!isEdit && (
        <Field label="Password" error={allErrors.password} required>
          <input
            type="password"
            value={form.password}
            onChange={set('password')}
            placeholder="Min 8 chars, 1 uppercase, 1 digit, 1 special"
            className={inputCls(allErrors.password)}
          />
        </Field>
      )}

      {/* Employee ID */}
      <Field label="Employee ID" error={allErrors.employeeId} required={!isEdit}>
        <input
          type="text"
          value={form.employeeId}
          onChange={set('employeeId')}
          placeholder="e.g. TCH-001"
          className={inputCls(allErrors.employeeId)}
        />
      </Field>

      {/* Phone */}
      <Field label="Phone" error={allErrors.phone}>
        <input
          type="tel"
          value={form.phone}
          onChange={set('phone')}
          placeholder="Optional"
          className={inputCls(allErrors.phone)}
        />
      </Field>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
      >
        {loading ? 'Saving…' : isEdit ? 'Update Teacher' : 'Create Teacher'}
      </button>
    </form>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Field({ label, error, required, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

const inputCls = (error) =>
  `w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-indigo-300 ${
    error ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white focus:border-indigo-400'
  }`;
