import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';
import useApi from '../hooks/useApi';
import formatDate from '../utils/formatDate';

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

// Scroll-triggered fade-up for sections below the fold
const scrollFade = reduced
  ? {}
  : {
      initial: { opacity: 0, y: 28 },
      whileInView: { opacity: 1, y: 0 },
      viewport: { once: true, margin: '-60px' },
      transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
    };

const cardHover = reduced ? {} : { y: -5, boxShadow: '0 16px 40px rgba(79,70,229,0.13)' };

// ── Public API ────────────────────────────────────────────────────────────────
const fetchAnnouncements = () =>
  axios
    .get(`${import.meta.env.VITE_API_URL}/public/announcements`)
    .then((r) => r.data);

// Is the announcement posted within the last 7 days?
const isNew = (date) => Date.now() - new Date(date) < 7 * 24 * 60 * 60 * 1000;

// ── Component ─────────────────────────────────────────────────────────────────
export default function Home() {
  const { data, loading, execute } = useApi(fetchAnnouncements);

  useEffect(() => {
    execute();
  }, [execute]);

  const announcements = data?.data?.announcements ?? [];

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
              <Link
                to="/login"
                className="group px-7 py-3.5 bg-indigo-600 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-200 hover:-translate-y-0.5 transition-all duration-200"
              >
                Log in to your account
                <span className="inline-block ml-1.5 group-hover:translate-x-0.5 transition-transform">→</span>
              </Link>
              <a
                href="#announcements"
                className="px-7 py-3.5 bg-white text-gray-700 font-semibold rounded-2xl shadow border border-gray-200 hover:bg-gray-50 hover:-translate-y-0.5 transition-all duration-200"
              >
                View announcements ↓
              </a>
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

        {/* ── Divider wave ─────────────────────────────────────────────────── */}
        <div className="bg-white">
          <svg viewBox="0 0 1440 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full text-gray-50" preserveAspectRatio="none">
            <path d="M0 40 C360 0 1080 0 1440 40 L1440 40 L0 40Z" fill="currentColor" />
          </svg>
        </div>

        {/* ── Announcements ─────────────────────────────────────────────────── */}
        <section id="announcements" className="bg-gray-50 py-20">
          <div className="max-w-6xl mx-auto px-6">

            {/* Section heading */}
            <motion.div {...scrollFade} className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-2">
                  From the school
                </p>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
                  Latest Announcements
                </h2>
              </div>
              {announcements.length > 0 && (
                <span className="text-sm text-gray-400 shrink-0">
                  {announcements.length} update{announcements.length !== 1 ? 's' : ''}
                </span>
              )}
            </motion.div>

            {/* Loading — 3 skeleton cards */}
            {loading && (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  >
                    <div className="flex gap-2 mb-4">
                      <div className="h-2.5 bg-gray-100 rounded-full w-16" />
                      <div className="flex-1" />
                      <div className="h-2.5 bg-gray-100 rounded-full w-20" />
                    </div>
                    <div className="h-3.5 bg-gray-200 rounded-full w-4/5 mb-3" />
                    <div className="h-2.5 bg-gray-100 rounded-full w-full mb-2" />
                    <div className="h-2.5 bg-gray-100 rounded-full w-11/12 mb-2" />
                    <div className="h-2.5 bg-gray-100 rounded-full w-3/5" />
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {!loading && announcements.length === 0 && (
              <motion.div {...scrollFade} className="text-center py-20">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-50 mb-4">
                  <span className="text-3xl">📢</span>
                </div>
                <p className="text-gray-700 font-semibold">No announcements yet</p>
                <p className="text-gray-400 text-sm mt-1">
                  Check back soon — your school will post updates here.
                </p>
              </motion.div>
            )}

            {/* Announcement cards — scroll-triggered stagger */}
            {!loading && announcements.length > 0 && (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {announcements.map((ann, i) => (
                  <motion.article
                    key={ann._id}
                    initial={reduced ? {} : { opacity: 0, y: 36 }}
                    whileInView={reduced ? {} : { opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{
                      delay: i * 0.09,
                      duration: 0.5,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    whileHover={cardHover}
                    className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col cursor-default"
                  >
                    {/* Top row: NEW badge + date */}
                    <div className="flex items-center gap-2 mb-3">
                      {isNew(ann.publishedAt) && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                          New
                        </span>
                      )}
                      <span className="flex-1" />
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {formatDate(ann.publishedAt)}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-sm font-semibold text-gray-900 leading-snug group-hover:text-indigo-700 transition-colors mb-2">
                      {ann.title}
                    </h3>

                    {/* Content preview */}
                    <p className="text-sm text-gray-500 leading-relaxed line-clamp-3 flex-1">
                      {ann.content}
                    </p>

                    {/* Author */}
                    {ann.teacherId?.userId?.name && (
                      <div className="mt-4 pt-3 border-t border-gray-50 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[11px] font-bold text-indigo-700">
                          {ann.teacherId.userId.name[0].toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-400">
                          {ann.teacherId.userId.name}
                        </span>
                      </div>
                    )}
                  </motion.article>
                ))}
              </div>
            )}
          </div>
        </section>

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
            <Link to="/login" className="hover:text-gray-700 transition-colors">
              Log in
            </Link>
            <Link to="/register" className="hover:text-gray-700 transition-colors">
              Register
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
