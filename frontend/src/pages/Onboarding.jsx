import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { checkSlugAvailability, registerSchool } from '../api/onboarding.api';
import { setCredentials } from '../redux/slices/authSlice';
import { setSchoolConfig } from '../redux/slices/schoolSlice';
import { staggerContainer, fadeInUp, slideInRight } from '../utils/animationVariants';

const TOTAL_STEPS = 3;

const stepVariants = {
  hidden: { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, x: -40, transition: { duration: 0.2 } },
};

export default function Onboarding() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    adminEmail: '',
    adminPassword: '',
    confirmPassword: '',
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [slugStatus, setSlugStatus] = useState(null); // null | 'checking' | 'available' | 'taken'
  const [slugSuggestions, setSlugSuggestions] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSlugCheck = useCallback(async (slug) => {
    if (!slug || slug.length < 3) return;
    setSlugStatus('checking');
    try {
      const { data } = await checkSlugAvailability(slug);
      if (data.data.available) {
        setSlugStatus('available');
        setSlugSuggestions([]);
      } else {
        setSlugStatus('taken');
        setSlugSuggestions(data.data.suggestions || []);
      }
    } catch {
      setSlugStatus(null);
    }
  }, []);

  const handleSlugBlur = () => handleSlugCheck(form.slug);

  const next = () => {
    setError('');
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };

  const back = () => {
    setError('');
    setStep((s) => Math.max(s - 1, 1));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.adminPassword !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    // The server rejects this too — the button being disabled is a courtesy,
    // not the enforcement.
    if (!acceptedTerms) {
      setError('Please accept the Terms of Service and Privacy Notice to continue');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await registerSchool({
        name: form.name,
        slug: form.slug,
        adminEmail: form.adminEmail,
        adminPassword: form.adminPassword,
        acceptedTerms: true,
      });

      const { school, user } = data.data;

      dispatch(
        setCredentials({
          user,
          role: user.role,
          schoolId: school._id,
          schoolSlug: school.slug,
        })
      );
      dispatch(
        setSchoolConfig({
          slug: school.slug,
          name: school.name,
          branding: school.branding,
        })
      );

      navigate(`/schools/${school.slug}/dashboard`);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        {/* Progress indicator */}
        <div className="flex justify-between mb-8">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
            <div
              key={s}
              className={`h-2 flex-1 rounded-full mx-1 transition-colors duration-300 ${
                s <= step ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              variants={stepVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <motion.div variants={staggerContainer} initial="hidden" animate="visible">
                <motion.h1 variants={fadeInUp} className="text-2xl font-bold text-gray-900 mb-2">
                  Set up your school
                </motion.h1>
                <motion.p variants={fadeInUp} className="text-gray-500 mb-6">
                  Choose a name and URL for your school workspace.
                </motion.p>

                <motion.div variants={fadeInUp} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      School Name
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="Springfield High School"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      School URL Slug
                    </label>
                    <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
                      <span className="bg-gray-100 px-3 py-2.5 text-gray-500 text-sm">
                        /schools/
                      </span>
                      <input
                        type="text"
                        name="slug"
                        value={form.slug}
                        onChange={handleChange}
                        onBlur={handleSlugBlur}
                        placeholder="springfield-high"
                        className="flex-1 px-3 py-2.5 focus:outline-none"
                      />
                    </div>
                    {slugStatus === 'checking' && (
                      <p className="text-xs text-gray-500 mt-1">Checking availability…</p>
                    )}
                    {slugStatus === 'available' && (
                      <p className="text-xs text-green-600 mt-1">✓ Slug is available</p>
                    )}
                    {slugStatus === 'taken' && (
                      <div className="mt-1">
                        <p className="text-xs text-red-500">✗ Slug is taken</p>
                        {slugSuggestions.length > 0 && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            Suggestions:{' '}
                            {slugSuggestions.map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => {
                                  setForm((prev) => ({ ...prev, slug: s }));
                                  setSlugStatus('available');
                                  setSlugSuggestions([]);
                                }}
                                className="text-blue-600 underline mr-2"
                              >
                                {s}
                              </button>
                            ))}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>

                <motion.button
                  variants={fadeInUp}
                  onClick={next}
                  disabled={!form.name || !form.slug || slugStatus === 'taken'}
                  className="mt-6 w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  Continue
                </motion.button>
              </motion.div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              variants={stepVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <motion.div variants={staggerContainer} initial="hidden" animate="visible">
                <motion.h1 variants={fadeInUp} className="text-2xl font-bold text-gray-900 mb-2">
                  Admin credentials
                </motion.h1>
                <motion.p variants={fadeInUp} className="text-gray-500 mb-6">
                  Create the administrator account for {form.name || 'your school'}.
                </motion.p>

                <motion.div variants={fadeInUp} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Admin Email
                    </label>
                    <input
                      type="email"
                      name="adminEmail"
                      value={form.adminEmail}
                      onChange={handleChange}
                      placeholder="admin@school.com"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      name="adminPassword"
                      value={form.adminPassword}
                      onChange={handleChange}
                      placeholder="Min 8 chars, 1 uppercase, 1 digit"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={form.confirmPassword}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </motion.div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={back}
                    className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={next}
                    disabled={!form.adminEmail || !form.adminPassword || !form.confirmPassword}
                    className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    Continue
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              variants={stepVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <motion.div variants={staggerContainer} initial="hidden" animate="visible">
                <motion.h1 variants={fadeInUp} className="text-2xl font-bold text-gray-900 mb-2">
                  Confirm &amp; launch
                </motion.h1>
                <motion.p variants={fadeInUp} className="text-gray-500 mb-6">
                  Review your details before creating the workspace.
                </motion.p>

                <motion.div
                  variants={slideInRight}
                  className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm mb-6"
                >
                  <div className="flex justify-between">
                    <span className="text-gray-500">School</span>
                    <span className="font-medium">{form.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">URL</span>
                    <span className="font-medium text-blue-600">/schools/{form.slug}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Admin</span>
                    <span className="font-medium">{form.adminEmail}</span>
                  </div>
                </motion.div>

                {/* Not pre-ticked: a pre-ticked box is not acceptance in most
                    jurisdictions. Links open in a new tab so a half-filled
                    three-step form is not lost. */}
                <motion.label
                  variants={fadeInUp}
                  className="flex gap-3 items-start mb-5 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-600 leading-relaxed">
                    I have read and agree to the{' '}
                    <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                      Privacy Notice
                    </Link>
                    . I am authorised to accept them for this school, and I understand the school is
                    responsible for the student, parent and staff data it enters — including telling
                    those people, or their guardians, that their records are held here.
                  </span>
                </motion.label>

                {error && (
                  <p className="text-sm text-red-500 mb-4">{error}</p>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={back}
                    className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading || !acceptedTerms}
                    className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {loading ? 'Creating…' : 'Create School'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
