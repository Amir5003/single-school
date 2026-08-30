import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { motion } from 'framer-motion';
import { loginUser } from '../../api/auth.api';
import { setTokens } from '../../api/tokenStorage';
import { setCredentials } from '../../redux/slices/authSlice';
import { fadeInUp } from '../../utils/animationVariants';
import { getDashboardPath } from '../../utils/dashboardPath';

/**
 * Reusable login form. Can be used standalone (Login page) or inside LoginModal.
 *
 * @param {object}   props
 * @param {function} [props.onSuccess] - Called with `user` after successful login
 * @param {function} [props.onCancel]  - If set, renders a Cancel button (used in modal)
 */
export default function LoginForm({ onSuccess, onCancel }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { slug: urlSlug } = useParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setLoading(true);

    try {
      const data = await loginUser({ email, password });
      const { user, accessToken, refreshToken, entitlements } = data.data;
      setTokens({ accessToken, refreshToken });
      // The login response populates schoolId — never fall back to the slug
      // held in Redux, which still belongs to the previously signed-in user.
      const resolvedSlug = user.schoolId?.slug ?? urlSlug ?? null;
      const resolvedId   = user.schoolId?._id  ?? user.schoolId ?? null;
      dispatch(
        setCredentials({
          user,
          role: user.role,
          schoolSlug: resolvedSlug,
          schoolId: resolvedId,
          entitlements: entitlements ?? null,
        })
      );

      // T049 — persist slug for Home.jsx restoration
      if (resolvedSlug) {
        localStorage.setItem('lastSchoolSlug', resolvedSlug);
      }

      // T030 — forced first-login password change
      if (user.mustChangePassword) {
        const base = resolvedSlug ? `/schools/${resolvedSlug}` : '';
        navigate(`${base}/change-password`, { replace: true });
        return;
      }

      if (onSuccess) {
        onSuccess(user);
      } else {
        navigate(getDashboardPath(user.role, resolvedSlug));
      }
    } catch (err) {
      const status = err.response?.status;
      if (status === 422) {
        const mapped = {};
        err.response.data.errors?.forEach(({ field, msg }) => { mapped[field] = msg; });
        setFieldErrors(mapped);
      } else if (status === 401) {
        setError('Invalid email or password. Please try again.');
      } else if (status === 403) {
        setError(err.response?.data?.message || 'Account pending admin approval.');
      } else {
        setError('Something went wrong. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible">
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="lf-email">
            Email address
          </label>
          <input
            id="lf-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 transition ${
              fieldErrors.email ? 'border-red-400' : 'border-gray-300'
            }`}
            placeholder="you@school.com"
          />
          {fieldErrors.email && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="lf-password">
            Password
          </label>
          <input
            id="lf-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 transition ${
              fieldErrors.password ? 'border-red-400' : 'border-gray-300'
            }`}
            placeholder="••••••••"
          />
          {fieldErrors.password && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
          )}
          <div className="mt-1 text-right">
            <Link to="/forgot-password" className="text-xs text-indigo-500 hover:underline">
              Forgot password?
            </Link>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-2 text-sm transition"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium py-2 text-sm transition"
          >
            Cancel
          </button>
        )}
      </form>
    </motion.div>
  );
}
