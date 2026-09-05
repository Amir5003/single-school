import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import axiosInstance from '../api/axiosInstance';
import { showToast } from '../redux/slices/uiSlice';
import { selectSchoolSlug, selectUser } from '../redux/slices/authSlice';
import { selectSchoolName } from '../redux/slices/schoolSlice';
import { fadeInUp } from '../utils/animationVariants';

export default function ChangePassword() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { slug: urlSlug } = useParams();
  const reduxSlug = useSelector(selectSchoolSlug);
  const schoolSlug = urlSlug ?? reduxSlug;
  const user = useSelector(selectUser);
  const schoolName = useSelector(selectSchoolName);

  // Every account an administrator creates is forced through this screen —
  // student.service.js and teacher.service.js both set mustChangePassword.
  // It is therefore the one moment we can be certain the person themselves is
  // reading, which makes it the right place to deliver the privacy notice they
  // never got a chance to see when their account was created.
  // Returning users who change a password voluntarily are not shown it.
  const showNotice = Boolean(user?.mustChangePassword);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]           = useState('');
  const [confirmPassword, setConfirmPassword]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await axiosInstance.put('/auth/change-password', { currentPassword, newPassword });
      dispatch(showToast({ message: 'Password changed successfully!', type: 'success' }));
      const base = schoolSlug ? `/schools/${schoolSlug}` : '';
      navigate(`${base}/student/dashboard`, { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message;
      setError(msg || 'Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="w-full max-w-md bg-white rounded-2xl shadow-md p-8"
      >
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-800">Change Password</h1>
          <p className="text-gray-500 text-sm mt-1">Please set a new password for your account</p>
        </div>

        {showNotice && (
          <div className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-4">
            <h2 className="text-sm font-semibold text-indigo-900 mb-1.5">
              Your school set up this account
            </h2>
            <p className="text-xs text-indigo-800/90 leading-relaxed">
              {schoolName || 'Your school'} created this account and holds your name, contact
              details, class, attendance, marks and fee records here. We keep it secure for the
              school and use it for nothing else — there is no advertising or tracking in this
              product, and your data is never sold.
            </p>
            <p className="text-xs text-indigo-800/90 leading-relaxed mt-2">
              To see, correct or remove anything held about you, contact your school.{' '}
              <Link
                to="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline"
              >
                Read the full privacy notice
              </Link>
              .
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="currentPwd">
              Current password
            </label>
            <input
              id="currentPwd"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 transition"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="newPwd">
              New password
            </label>
            <input
              id="newPwd"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 transition"
              placeholder="Min 8 characters"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="confirmPwd">
              Confirm new password
            </label>
            <input
              id="confirmPwd"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 transition"
              placeholder="Repeat new password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-2 text-sm transition"
          >
            {loading ? 'Saving…' : 'Change Password'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
