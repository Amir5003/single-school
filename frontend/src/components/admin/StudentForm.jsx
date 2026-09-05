import { useState, useEffect } from 'react';

const PASSWORD_REGEX = /(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}/;

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
 *   classes      — the school's classes, for the assignment dropdown. Required
 *                  to pick one; when the school has none yet the field is
 *                  replaced by a prompt and the student is created unassigned.
 */
export default function StudentForm({
  initialData = null,
  onSubmit,
  loading = false,
  apiErrors = {},
  classes = [],
}) {
  const isEdit = !!initialData;

  const [form, setForm] = useState({
    name: initialData?.userId?.name ?? '',
    email: initialData?.userId?.email ?? '',
    password: '',
    phone: initialData?.userId?.phone ?? '',
    dateOfBirth: toDateInputValue(initialData?.dateOfBirth),
    address: initialData?.address ?? '',
    // classId arrives populated ({ _id, name, section }) on edit
    classId: initialData?.classId?._id ?? '',
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
    }
    if (!form.dateOfBirth) errs.dateOfBirth = 'Date of birth is required';
    // Unassigned students get no timetable, attendance, homework or fees — so
    // a class is required whenever there is one to pick.
    if (classes.length > 0 && !form.classId) {
      errs.classId = 'Select a class — an unassigned student has no timetable, attendance or fees';
    }
    setLocalErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    // enrollmentId is deliberately absent: the server allocates it on create,
    // and it is printed on report cards afterwards, so it is never sent on edit.
    const payload = { ...form };

    // The dropdown is only rendered when classes loaded. Sending an empty
    // classId because the list failed to load would silently unassign the
    // student, so leave the field out entirely instead.
    if (classes.length === 0) delete payload.classId;

    if (isEdit) {
      // email and password are not updatable
      delete payload.email;
      delete payload.password;
    }

    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} noValidate autoComplete="off" className="space-y-4">
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
          autoComplete="off"
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

      {/* Class — assigns the student on save; the school may have none yet */}
      <Field label="Class" error={allErrors.classId} required={classes.length > 0}>
        {classes.length > 0 ? (
          <>
            <select
              value={form.classId}
              onChange={set('classId')}
              className={inputCls(allErrors.classId)}
            >
              <option value="">Select a class…</option>
              {classes.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                  {c.section ? ` – ${c.section}` : ''}
                </option>
              ))}
            </select>
            {isEdit && (
              <p className="text-xs text-gray-400 mt-1">
                Changing this moves the student to another class.
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            No classes yet — create one on the Classes page first. This student can
            be created now, but stays unassigned until you add them to a class.
          </p>
        )}
      </Field>

      {/* Enrollment ID — allocated by the server; read-only reference */}
      {isEdit && (
        <Field label="Enrollment ID">
          <p className="text-sm font-mono text-gray-700">{initialData.enrollmentId || '—'}</p>
          <p className="text-xs text-gray-400 mt-1">
            Cannot be changed — it appears on issued report cards.
          </p>
        </Field>
      )}

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

      {!isEdit && (
        <p className="text-xs text-gray-400">
          An Enrollment ID is assigned automatically when you save.
        </p>
      )}

      {/* Standing notice — always visible, never a blocking dialog. A modal on
          every save becomes muscle memory inside a week and stops meaning
          anything; a line the admin reads while typing the email address does
          not. */}
      {!isEdit && (
        <p className="text-xs text-gray-500 leading-relaxed rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5">
          This creates an account in this person&apos;s name and emails a temporary password to the
          address you enter. Confirm the address belongs to them or their guardian, and make sure
          they have been told their records are held here.
        </p>
      )}

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
