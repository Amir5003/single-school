import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TermsAcceptance from '../components/common/TermsAcceptance';
import { motion, AnimatePresence } from 'framer-motion';
import { registerUser } from '../api/auth.api';
import { checkSlugAvailability, registerSchool } from '../api/onboarding.api';
import { getSchoolConfig } from '../api/school.api';
import { fadeInUp } from '../utils/animationVariants';

const ROLES = [
  { value: 'student', label: 'Student' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'parent', label: 'Parent' },
  { value: 'school-admin', label: 'School Admin (register a new school)' },
];

// ── helpers ──────────────────────────────────────────────────────────────────

function FieldError({ msg }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-red-600">{msg}</p>;
}

function InputField({ id, label, type = 'text', autoComplete, value, onChange, error, placeholder, disabled, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={id}>
        {label}
      </label>
      {children || (
        <input
          id={id}
          name={id}
          type={type}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 transition ${
            error ? 'border-red-400' : 'border-gray-300'
          } disabled:bg-gray-50 disabled:text-gray-400`}
        />
      )}
      <FieldError msg={error} />
    </div>
  );
}

// ── success screen ────────────────────────────────────────────────────────────

function SuccessScreen({ isSchoolAdmin, navigate }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="w-full max-w-md bg-white rounded-2xl shadow-md p-8 text-center"
      >
        <div className="mb-4 flex justify-center">
          <span className="text-5xl">✅</span>
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">
          {isSchoolAdmin ? 'School Registration Submitted!' : 'Account Created!'}
        </h2>
        <p className="text-gray-500 text-sm mb-6">
          {isSchoolAdmin
            ? 'Your school registration is pending super-admin approval. You will be able to log in once approved.'
            : 'Your account is awaiting school admin approval before you can log in. Please check back later.'}
        </p>
        <button
          onClick={() => navigate('/login')}
          className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 text-sm transition"
        >
          Back to Sign In
        </button>
      </motion.div>
    </div>
  );
}

// ── School Admin Form ─────────────────────────────────────────────────────────

function SchoolAdminForm({ onSuccess }) {
  const [form, setForm] = useState({
    schoolName: '',
    slug: '',
    phone: '',
    adminEmail: '',
    adminPassword: '',
  });
  const [slugStatus, setSlugStatus] = useState(null); // null | 'checking' | 'available' | 'taken'
  const [slugSuggestions, setSlugSuggestions] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const debounceRef = useRef(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: '' }));

    if (name === 'slug') {
      const clean = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
      setForm((prev) => ({ ...prev, slug: clean }));
      setSlugStatus('checking');
      setSlugSuggestions([]);
      clearTimeout(debounceRef.current);
      if (!clean) { setSlugStatus(null); return; }
      debounceRef.current = setTimeout(async () => {
        try {
          const res = await checkSlugAvailability(clean);
          const { available, suggestions } = res.data?.data ?? res.data ?? {};
          setSlugStatus(available ? 'available' : 'taken');
          setSlugSuggestions(suggestions || []);
        } catch {
          setSlugStatus(null);
        }
      }, 500);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (slugStatus !== 'available') {
      setFieldErrors((prev) => ({ ...prev, slug: 'Please enter an available slug' }));
      return;
    }
    // The server rejects this too — the disabled button is a courtesy, not the
    // enforcement.
    if (!acceptedTerms) {
      setError('Please accept the Terms of Service and Privacy Notice to continue');
      return;
    }

    setLoading(true);
    try {
      await registerSchool({
        name: form.schoolName,
        slug: form.slug,
        adminEmail: form.adminEmail,
        adminPassword: form.adminPassword,
        phone: form.phone || undefined,
        acceptedTerms: true,
      });
      onSuccess();
    } catch (err) {
      const status = err.response?.status;
      if (status === 422) {
        const mapped = {};
        err.response.data.errors?.forEach(({ field, msg }) => { mapped[field] = msg; });
        setFieldErrors(mapped);
      } else if (status === 409) {
        setError(err.response?.data?.message || 'Email or slug already in use.');
      } else {
        setError('Something went wrong. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const slugHint = slugStatus === 'available'
    ? <span className="text-green-600 text-xs mt-1 block">✓ Slug is available</span>
    : slugStatus === 'taken'
    ? <span className="text-red-600 text-xs mt-1 block">✗ Slug is taken{slugSuggestions.length ? ` — try: ${slugSuggestions.join(', ')}` : ''}</span>
    : slugStatus === 'checking'
    ? <span className="text-gray-400 text-xs mt-1 block">Checking…</span>
    : null;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}

      <InputField id="schoolName" label="School Name" value={form.schoolName}
        onChange={handleChange} error={fieldErrors.schoolName}
        placeholder="Springfield High School" />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="slug">
          School Slug <span className="text-gray-400 font-normal">(URL identifier)</span>
        </label>
        <input
          id="slug"
          name="slug"
          type="text"
          value={form.slug}
          onChange={handleChange}
          placeholder="springfield-high"
          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 transition font-mono ${
            fieldErrors.slug ? 'border-red-400' : 'border-gray-300'
          }`}
        />
        {slugHint}
        <FieldError msg={fieldErrors.slug} />
      </div>

      <InputField id="phone" label="Contact Phone (optional)" type="tel"
        value={form.phone} onChange={handleChange} error={fieldErrors.phone}
        placeholder="+1 555 000 1234" />

      <hr className="border-gray-100" />
      <p className="text-xs text-gray-500">Your admin account details</p>

      <InputField id="adminEmail" label="Email Address" type="email" autoComplete="email"
        value={form.adminEmail} onChange={handleChange} error={fieldErrors.adminEmail}
        placeholder="admin@school.com" />

      <InputField id="adminPassword" label="Password" type="password" autoComplete="new-password"
        value={form.adminPassword} onChange={handleChange} error={fieldErrors.adminPassword}
        placeholder="Min 8 chars, uppercase, digit, symbol" />

      <TermsAcceptance checked={acceptedTerms} onChange={setAcceptedTerms} />

      <button
        type="submit"
        disabled={loading || slugStatus !== 'available' || !acceptedTerms}
        className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 text-sm transition disabled:opacity-50"
      >
        {loading ? 'Submitting…' : 'Register School'}
      </button>
    </form>
  );
}

// ── Teacher / Student / Parent Form ──────────────────────────────────────────

function MemberForm({ role, onSuccess }) {
  const [step, setStep] = useState(1); // 1 = slug lookup, 2 = registration
  const [slug, setSlug] = useState('');
  const [slugLookupLoading, setSlugLookupLoading] = useState(false);
  const [slugError, setSlugError] = useState('');
  const [school, setSchool] = useState(null); // { _id, name, slug }

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSlugLookup = async (e) => {
    e.preventDefault();
    if (!slug.trim()) return;
    setSlugLookupLoading(true);
    setSlugError('');
    try {
      const res = await getSchoolConfig(slug.trim().toLowerCase());
      const s = res.data?.data?.school ?? res.data?.data ?? res.data;
      setSchool({ _id: s._id, name: s.name, slug: s.slug });
      setStep(2);
    } catch (err) {
      const status = err.response?.status;
      if (status === 404) setSlugError('No school found with that slug.');
      else setSlugError('Could not look up the school. Please try again.');
    } finally {
      setSlugLookupLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setLoading(true);
    try {
      await registerUser({ ...form, role, schoolId: school._id });
      onSuccess();
    } catch (err) {
      const status = err.response?.status;
      if (status === 422) {
        const mapped = {};
        err.response.data.errors?.forEach(({ field, msg }) => { mapped[field] = msg; });
        setFieldErrors(mapped);
      } else if (status === 409) {
        setError('An account with this email already exists.');
      } else {
        setError('Something went wrong. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (step === 1) {
    return (
      <form onSubmit={handleSlugLookup} noValidate className="space-y-5">
        <p className="text-sm text-gray-600">
          Enter your school&apos;s slug to get started.
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="schoolSlug">
            School Slug
          </label>
          <input
            id="schoolSlug"
            type="text"
            value={slug}
            onChange={(e) => { setSlug(e.target.value); setSlugError(''); }}
            placeholder="springfield-high"
            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 transition font-mono ${
              slugError ? 'border-red-400' : 'border-gray-300'
            }`}
          />
          {slugError && <p className="mt-1 text-xs text-red-600">{slugError}</p>}
        </div>
        <button
          type="submit"
          disabled={slugLookupLoading || !slug.trim()}
          className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 text-sm transition disabled:opacity-50"
        >
          {slugLookupLoading ? 'Looking up…' : 'Find School →'}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="rounded-lg bg-indigo-50 border border-indigo-200 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-indigo-500 font-medium uppercase tracking-wide">Registering for</p>
          <p className="text-sm font-semibold text-indigo-800">{school.name}</p>
        </div>
        <button
          type="button"
          onClick={() => { setStep(1); setSchool(null); setForm({ name: '', email: '', password: '' }); setFieldErrors({}); setError(''); }}
          className="text-xs text-indigo-600 hover:underline"
        >
          Change
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}

      <InputField id="name" label="Full Name" autoComplete="name"
        value={form.name} onChange={handleChange} error={fieldErrors.name}
        placeholder="Your full name" />

      <InputField id="email" label="Email Address" type="email" autoComplete="email"
        value={form.email} onChange={handleChange} error={fieldErrors.email}
        placeholder="you@school.com" />

      <InputField id="password" label="Password" type="password" autoComplete="new-password"
        value={form.password} onChange={handleChange} error={fieldErrors.password}
        placeholder="Min 8 chars, uppercase, digit, symbol" />

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 text-sm transition disabled:opacity-50"
      >
        {loading ? 'Creating account…' : 'Create Account'}
      </button>
    </form>
  );
}

// ── Main Register page ────────────────────────────────────────────────────────

export default function Register() {
  const navigate = useNavigate();
  const [role, setRole] = useState('student');
  const [success, setSuccess] = useState(false);

  if (success) {
    return <SuccessScreen isSchoolAdmin={role === 'school-admin'} navigate={navigate} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="w-full max-w-md bg-white rounded-2xl shadow-md p-8"
      >
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-800">Create an Account</h1>
          <p className="text-gray-500 text-sm mt-1">Choose how you&apos;d like to join</p>
        </div>

        {/* Role selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">I am a…</label>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRole(r.value)}
                className={`py-2 px-3 rounded-lg border text-sm font-medium transition text-left ${
                  role === r.value
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={role} variants={fadeInUp} initial="hidden" animate="visible">
            {role === 'school-admin' ? (
              <SchoolAdminForm onSuccess={() => setSuccess(true)} />
            ) : (
              <MemberForm role={role} onSuccess={() => setSuccess(true)} />
            )}
          </motion.div>
        </AnimatePresence>

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="text-indigo-600 hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

