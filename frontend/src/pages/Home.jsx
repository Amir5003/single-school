import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSelector, useDispatch } from 'react-redux';
import { useEffect } from 'react';
import { selectUser, selectRole, selectIsAuthenticated, selectSchoolSlug, clearCredentials } from '../redux/slices/authSlice';
import { logoutUser } from '../api/auth.api';
import { clearTokens } from '../api/tokenStorage';

// ── Motion helpers ────────────────────────────────────────────────────────────
const reduced =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Hero entrance: each element gets a staggered delay via the `i` parameter
const heroFade = (i = 0) =>
  reduced
    ? {}
    : {
        initial: { opacity: 0, y: 36 },
        animate: { opacity: 1, y: 0 },
        transition: { delay: i * 0.13, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
      };

// ── Helpers ──────────────────────────────────────────────────────────────────
const ROLE_LABELS = {
  'super-admin': 'Super Admin',
  'school-admin': 'School Admin',
  teacher: 'Teacher',
  student: 'Student',
  parent: 'Parent',
};

function getDashboardPath(role, schoolSlug) {
  if (role === 'super-admin') return '/platform/schools';
  if (!schoolSlug) return '/';
  if (role === 'school-admin') return `/schools/${schoolSlug}/admin/dashboard`;
  if (role === 'teacher') return `/schools/${schoolSlug}/teacher/dashboard`;
  if (role === 'student') return `/schools/${schoolSlug}/student/dashboard`;
  if (role === 'parent') return `/schools/${schoolSlug}/parent/dashboard`;
  return '/';
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Home() {
  const user = useSelector(selectUser);
  const role = useSelector(selectRole);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const schoolSlug = useSelector(selectSchoolSlug);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const dashboardPath = getDashboardPath(role, schoolSlug);

  // T050 — restore school context from localStorage on mount
  const lastSlug = typeof localStorage !== 'undefined'
    ? localStorage.getItem('lastSchoolSlug')
    : null;

  useEffect(() => {
    if (isAuthenticated && lastSlug) {
      navigate(getDashboardPath(role, lastSlug), { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    try { await logoutUser(); } catch { /* tokens cleared regardless */ }
    clearTokens();
    dispatch(clearCredentials());
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col overflow-x-hidden">

      {/* ── Sticky Nav ────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              S
            </span>
            <span className="font-semibold text-gray-900 text-sm tracking-tight">
              School&nbsp;Management
            </span>
          </div>
          <nav className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <span className="text-sm text-gray-600 hidden sm:block">
                  {user?.name}
                  <span className="ml-1.5 px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded-full font-medium">
                    {ROLE_LABELS[role] ?? role}
                  </span>
                </span>
                <Link
                  to={dashboardPath}
                  className="px-4 py-1.5 text-sm font-medium text-indigo-600 rounded-xl border border-indigo-200 hover:bg-indigo-50 transition-colors"
                >
                  Dashboard
                </Link>
                <button
                  onClick={handleLogout}
                  className="px-4 py-1.5 text-sm font-medium bg-red-50 text-red-600 rounded-xl border border-red-200 hover:bg-red-100 transition-colors"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                {lastSlug && (
                  <Link
                    to={`/schools/${lastSlug}`}
                    className="px-4 py-1.5 text-sm font-medium text-indigo-600 rounded-xl border border-indigo-200 hover:bg-indigo-50 transition-colors"
                  >
                    Return to school portal
                  </Link>
                )}
                <Link
                  to="/register"
                  className="px-4 py-1.5 text-sm font-medium text-indigo-600 rounded-xl border border-indigo-200 hover:bg-indigo-50 transition-colors"
                >
                  Register
                </Link>
                <Link
                  to="/login"
                  className="px-4 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  Log in
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-white">
          {/* Floating gradient orbs — purely decorative */}
          {!reduced && (
            <>
              <motion.div
                className="pointer-events-none absolute -top-48 -left-48 w-[600px] h-[600px] rounded-full bg-indigo-200/35 blur-3xl"
                animate={{ x: [0, 32, 0], y: [0, -22, 0] }}
                transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div
                className="pointer-events-none absolute -bottom-32 -right-48 w-[500px] h-[500px] rounded-full bg-purple-200/35 blur-3xl"
                animate={{ x: [0, -28, 0], y: [0, 20, 0] }}
                transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
              />
              <motion.div
                className="pointer-events-none absolute top-32 left-1/2 -translate-x-1/2 w-[300px] h-[300px] rounded-full bg-pink-100/30 blur-2xl"
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
              />
            </>
          )}

          <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-28 text-center">
            {/* Live badge */}
            <motion.div
              {...heroFade(0)}
              className="inline-flex items-center gap-2 px-3.5 py-1 mb-7 rounded-full bg-indigo-50 border border-indigo-100 text-xs font-semibold text-indigo-700 tracking-wide"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
              </span>
              Live updates from school
            </motion.div>

            {/* Main headline */}
            <motion.h1
              {...heroFade(1)}
              className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-gray-900 leading-[1.1] tracking-tight"
            >
              Your school,{' '}
              <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">
                all in one place
              </span>
            </motion.h1>

            <motion.p
              {...heroFade(2)}
              className="mt-6 text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed"
            >
              Attendance, marks, timetables and announcements — curated by your
              school and updated in real time.
            </motion.p>

            {/* CTA row */}
            <motion.div
              {...heroFade(3)}
              className="mt-10 flex flex-wrap gap-4 justify-center"
            >
              {isAuthenticated ? (
                <Link
                  to={dashboardPath}
                  className="group px-7 py-3.5 bg-indigo-600 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-200 hover:-translate-y-0.5 transition-all duration-200"
                >
                  Go to your Dashboard
                  <span className="inline-block ml-1.5 group-hover:translate-x-0.5 transition-transform">→</span>
                </Link>
              ) : (
                <Link
                  to="/login"
                  className="group px-7 py-3.5 bg-indigo-600 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-200 hover:-translate-y-0.5 transition-all duration-200"
                >
                  Log in to your account
                  <span className="inline-block ml-1.5 group-hover:translate-x-0.5 transition-transform">→</span>
                </Link>
              )}
            </motion.div>

            {/* Feature pills */}
            <motion.div
              {...heroFade(4)}
              className="mt-12 flex flex-wrap justify-center gap-2.5"
            >
              {[
                { icon: '📋', label: 'Attendance' },
                { icon: '🎯', label: 'Marks & Grades' },
                { icon: '🗓️', label: 'Timetables' },
                { icon: '📢', label: 'Announcements' },
              ].map(({ icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-100 text-xs font-medium text-gray-600"
                >
                  <span>{icon}</span>
                  {label}
                </span>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── Features Grid ─────────────────────────────────────────────────── */}
        <section className="bg-gray-50 py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <motion.div
              {...heroFade(0)}
              className="text-center mb-14"
            >
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
                Everything your school needs
              </h2>
              <p className="mt-3 text-gray-500 text-lg max-w-xl mx-auto">
                One platform to manage every part of your school's daily operations.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  icon: '📋',
                  title: 'Attendance Tracking',
                  desc: 'Teachers mark attendance class-by-class. Students and parents see real-time records.',
                },
                {
                  icon: '🎯',
                  title: 'Marks & Grades',
                  desc: 'Enter subject-wise marks, view class performance, and share results instantly.',
                },
                {
                  icon: '📝',
                  title: 'Exam Management',
                  desc: 'Create exams, assign them to teachers, collect submissions, and publish dashboards.',
                },
                {
                  icon: '🗓️',
                  title: 'Timetables',
                  desc: 'Build and publish class timetables. Students access theirs without logging in.',
                },
                {
                  icon: '💳',
                  title: 'Fee Management',
                  desc: 'Record and track student fee payments with status across all classes.',
                },
                {
                  icon: '📢',
                  title: 'Announcements',
                  desc: 'Broadcast to all or target specific roles — teachers, students, or parents.',
                },
              ].map(({ icon, title, desc }) => (
                <motion.div
                  key={title}
                  {...heroFade(0)}
                  className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center text-2xl mb-4">
                    {icon}
                  </div>
                  <h3 className="font-semibold text-gray-900 text-base mb-1.5">{title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Built for every role ───────────────────────────────────────────── */}
        <section className="bg-white py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <motion.div {...heroFade(0)} className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
                Built for every role
              </h2>
              <p className="mt-3 text-gray-500 text-lg max-w-xl mx-auto">
                A tailored experience for everyone in your school.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  role: 'Admin',
                  color: 'from-indigo-500 to-violet-600',
                  bg: 'bg-indigo-50',
                  text: 'text-indigo-700',
                  items: ['Manage students & teachers', 'Approve pending accounts', 'Customize school branding', 'Track fees & exams'],
                },
                {
                  role: 'Teacher',
                  color: 'from-emerald-500 to-teal-600',
                  bg: 'bg-emerald-50',
                  text: 'text-emerald-700',
                  items: ['Mark attendance by class', 'Enter marks per subject', 'Post announcements', 'Manage and grade exams'],
                },
                {
                  role: 'Student',
                  color: 'from-orange-400 to-pink-500',
                  bg: 'bg-orange-50',
                  text: 'text-orange-700',
                  items: ['View attendance record', 'Check marks & results', 'See class timetable', 'Read announcements'],
                },
                // {
                //   role: 'Parent',
                //   color: 'from-sky-500 to-cyan-600',
                //   bg: 'bg-sky-50',
                //   text: 'text-sky-700',
                //   items: ["Monitor child's attendance", "Track child's performance", 'Stay informed with updates', 'Multi-child support'],
                // },
              ].map(({ role, color, bg, text, items }) => (
                <motion.div
                  key={role}
                  {...heroFade(0)}
                  className="rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className={`bg-gradient-to-br ${color} px-5 py-4`}>
                    <span className="text-white font-bold text-lg">{role}</span>
                  </div>
                  <div className="p-5 bg-white">
                    <ul className="space-y-2">
                      {items.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                          <span className={`mt-0.5 w-4 h-4 rounded-full ${bg} ${text} flex items-center justify-center text-xs font-bold flex-shrink-0`}>✓</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Multi-school SaaS callout ──────────────────────────────────────── */}
        {!isAuthenticated && (
          <section className="bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 py-16 px-6">
            <motion.div {...heroFade(0)} className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Ready to bring your school online?
              </h2>
              <p className="mt-4 text-indigo-200 text-lg max-w-xl mx-auto">
                Register your school in minutes. Custom branding, role-based access, and live updates — all included.
              </p>
              <div className="mt-8 flex flex-wrap gap-4 justify-center">
                <Link
                  to="/register"
                  className="px-7 py-3.5 bg-white text-indigo-700 font-semibold rounded-2xl shadow-lg hover:bg-indigo-50 hover:-translate-y-0.5 transition-all duration-200"
                >
                  Register your school →
                </Link>
                <Link
                  to="/login"
                  className="px-7 py-3.5 bg-indigo-500/40 text-white font-semibold rounded-2xl border border-indigo-400/50 hover:bg-indigo-500/60 hover:-translate-y-0.5 transition-all duration-200"
                >
                  Log in
                </Link>
              </div>
            </motion.div>
          </section>
        )}

      </main>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 py-8 bg-white">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
              S
            </span>
            <span className="text-xs text-gray-500 font-medium">
              School Management System
            </span>
          </div>
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} All rights reserved.
          </p>
          <nav className="flex gap-5 text-xs text-gray-400">
            {isAuthenticated ? (
              <>
                <Link to={dashboardPath} className="hover:text-gray-700 transition-colors">
                  Dashboard
                </Link>
                <button
                  onClick={handleLogout}
                  className="hover:text-red-600 transition-colors"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="hover:text-gray-700 transition-colors">
                  Log in
                </Link>
                <Link to="/register" className="hover:text-gray-700 transition-colors">
                  Register
                </Link>
              </>
            )}
          </nav>
        </div>
      </footer>
    </div>
  );
}
