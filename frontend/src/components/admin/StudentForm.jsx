import { useState } from 'react';

const PASSWORD_REGEX = /(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}/;
const ENROLLMENT_REGEX = /^[A-Z0-9-]+$/;

/** Safely convert an API dateOfBirth value to "YYYY-MM-DD" for <input type="date"> */
function toDateInputValue(dob) {
  if (!dob) return '';
  const s = typeof dob === 'string' ? dob : new Date(dob).toISOString();
  return s.slice(0, 10);
}

/**
 * Reusable controlled form for creating or editing a student.
 *
 * Props:
 *   initialData  — student doc (populated) for edit mode; null for create mode
 *   onSubmit     — (formData: object) => void
 *   loading      — boolean — disables submit button
 *   apiErrors    — { [field]: message } — 422 errors returned from the API
 */
export default function StudentForm({
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
    enrollmentId: initialData?.enrollmentId ?? '',
    dateOfBirth: toDateInputValue(initialData?.dateOfBirth),
    address: initialData?.address ?? '',
  });

  const [localErrors, setLocalErrors] = useState({});

  // Merge local client-side errors with API-returned 422 errors
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
        errs.password =
          'Must be 8+ chars with 1 uppercase, 1 digit, and 1 special character';
      }
      if (!form.enrollmentId.trim()) errs.enrollmentId = 'Enrollment ID is required';
    }
    if (
      form.enrollmentId.trim() &&
      !ENROLLMENT_REGEX.test(form.enrollmentId.trim().toUpperCase())
    ) {
      errs.enrollmentId = 'Use uppercase letters, digits, and hyphens only (e.g. STU-001)';
    }
    if (!form.dateOfBirth) errs.dateOfBirth = 'Date of birth is required';
    setLocalErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      ...form,
      enrollmentId: form.enrollmentId.trim().toUpperCase(),
    };

    if (isEdit) {
      // email and password are not updatable
      delete payload.email;
      delete payload.password;
    }

    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Name */}
      <Field
        label="Full Name"
        error={allErrors.name}
        required
      >
        <input
          type="text"
          value={form.name}
          onChange={set('name')}
          placeholder="e.g. Alice Smith"
          className={inputCls(allErrors.name)}
        />
      </Field>

      {/* Email — required on create; read-only on edit */}
      <Field label="Email" error={allErrors.email} required={!isEdit}>
        <input
          type="email"
          value={form.email}
          onChange={set('email')}
          placeholder="student@school.com"
          readOnly={isEdit}
          disabled={isEdit}
          className={isEdit ? inputCls() + ' bg-gray-50 cursor-not-allowed' : inputCls(allErrors.email)}
        />
        {isEdit && (
          <p className="text-xs text-gray-400 mt-1">Email cannot be changed after creation.</p>
        )}
      </Field>

      {/* Password — create only */}
      {!isEdit && (
        <Field label="Password" error={allErrors.password} required>
          <input
            type="password"
            value={form.password}
            onChange={set('password')}
            placeholder="Min 8 chars, 1 uppercase, 1 digit, 1 special char"
            className={inputCls(allErrors.password)}
            autoComplete="new-password"
          />
        </Field>
      )}

      {/* Phone */}
      <Field label="Phone" error={allErrors.phone}>
        <input
          type="tel"
          value={form.phone}
          onChange={set('phone')}
          placeholder="e.g. 5550001111"
          maxLength={15}
          className={inputCls(allErrors.phone)}
        />
      </Field>

      {/* Enrollment ID */}
      <Field label="Enrollment ID" error={allErrors.enrollmentId} required={!isEdit}>
        <input
          type="text"
          value={form.enrollmentId}
          onChange={set('enrollmentId')}
          placeholder="e.g. STU-001"
          className={inputCls(allErrors.enrollmentId)}
          style={{ textTransform: 'uppercase' }}
        />
      </Field>

      {/* Date of Birth */}
      <Field label="Date of Birth" error={allErrors.dateOfBirth} required>
        <input
          type="date"
          value={form.dateOfBirth}
          onChange={set('dateOfBirth')}
          max={new Date().toISOString().slice(0, 10)}
          className={inputCls(allErrors.dateOfBirth)}
        />
      </Field>

      {/* Address */}
      <Field label="Address" error={allErrors.address}>
        <textarea
          value={form.address}
          onChange={set('address')}
          rows={2}
          maxLength={300}
          placeholder="Street, City"
          className={inputCls(allErrors.address) + ' resize-none'}
        />
      </Field>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
      >
        {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Student'}
      </button>
    </form>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({ label, error, required = false, children }) {
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

function inputCls(error = '') {
  const base =
    'w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-indigo-300';
  return error
    ? `${base} border-red-400 bg-red-50 focus:border-red-500`
    : `${base} border-gray-200 bg-white focus:border-indigo-400`;
}
