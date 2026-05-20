import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import axiosInstance from '../api/axiosInstance';
import { fadeInUp } from '../utils/animationVariants';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await axiosInstance.post('/auth/forgot-password', { email });
      setSubmitted(true);
    } catch (err) {
      if (err.response?.status === 429) {
        setError('Too many requests. Please try again later.');
      } else {
        // Show the same neutral message for all failures to avoid enumeration
        setSubmitted(true);
      }
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
          <h1 className="text-2xl font-bold text-gray-800">Forgot Password</h1>
          <p className="text-gray-500 text-sm mt-1">
            Enter your email to receive a reset link
          </p>
        </div>

        {submitted ? (
          <div className="text-center">
            <p className="text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm">
              If that email is registered, you&apos;ll receive a reset link shortly.
            </p>
            <Link
              to="/login"
              className="mt-4 inline-block text-sm text-indigo-600 hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <div>
                <label
                  className="block text-sm font-medium text-gray-700 mb-1"
                  htmlFor="email"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 transition"
                  placeholder="you@school.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-2 text-sm transition"
              >
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>
            <p className="mt-6 text-center text-sm text-gray-500">
              Remember your password?{' '}
              <Link to="/login" className="text-indigo-600 hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
