import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { selectSchoolName, selectSchoolBranding, selectSchoolContextSlug } from '../redux/slices/schoolSlice';
import { getSchoolPublicAnnouncements } from '../api/school.api';
import { fadeInUp, staggerContainer } from '../utils/animationVariants';

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function SchoolLanding() {
  const { slug } = useParams();

  // SchoolContextLoader (parent) already fetches config and populates Redux.
  // We just read from the store — no duplicate fetch needed.
  const reduxSlug = useSelector(selectSchoolContextSlug);
  const schoolName = useSelector(selectSchoolName);
  const branding = useSelector(selectSchoolBranding);

  const [announcements, setAnnouncements] = useState([]);

  // Fetch public announcements for this school once we know the slug is valid
  useEffect(() => {
    let cancelled = false;
    getSchoolPublicAnnouncements(slug)
      .then((res) => {
        if (!cancelled) {
          setAnnouncements(res.data?.data?.announcements ?? []);
        }
      })
      .catch(() => {
        // Announcements are optional — silently ignore errors
      });
    return () => { cancelled = true; };
  }, [slug]);

  // Show spinner while SchoolContextLoader is still fetching (Redux not yet populated
  // for this slug, or populated for a different slug from a previous visit)
  if (!schoolName || reduxSlug !== slug) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  // SchoolContextLoader handles 404 by navigating to /school-not-found,
  // so by the time we render here the school is guaranteed to exist.

  const primary = branding?.primaryColor || '#4f46e5';

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* ── Navbar ────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          {branding?.logoUrl ? (
            <img src={branding.logoUrl} alt={schoolName} className="h-9 object-contain" />
          ) : (
            <div className="flex items-center gap-2.5">
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm"
                style={{ backgroundColor: primary }}
              >
                {schoolName?.[0] ?? 'S'}
              </span>
              <span className="font-semibold text-gray-900 text-sm tracking-tight">
                {schoolName}
              </span>
            </div>
          )}
          <Link
            to={`/schools/${slug}/login`}
            className="px-4 py-1.5 text-sm font-medium text-white rounded-xl shadow-sm hover:opacity-90 transition-opacity"
            style={{ backgroundColor: primary }}
          >
            Login
          </Link>
        </div>
      </header>

      <main className="flex-1">

        {/* ── Hero ──────────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-gradient-to-br from-gray-50 to-white">
          <div
            className="pointer-events-none absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full blur-3xl opacity-20"
            style={{ backgroundColor: primary }}
          />
          <div
            className="pointer-events-none absolute -bottom-24 -right-40 w-[400px] h-[400px] rounded-full blur-3xl opacity-10"
            style={{ backgroundColor: primary }}
          />

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="relative max-w-5xl mx-auto px-6 pt-20 pb-24 text-center"
          >
            {branding?.logoUrl && (
              <motion.img
                variants={fadeInUp}
                src={branding.logoUrl}
                alt={schoolName}
                className="h-20 mx-auto mb-6 object-contain"
              />
            )}

            <motion.h1
              variants={fadeInUp}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-[1.1] tracking-tight"
            >
              Welcome to{' '}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: `linear-gradient(135deg, ${primary}, ${branding?.secondaryColor || primary}cc)`,
                }}
              >
                {schoolName}
              </span>
            </motion.h1>

            {branding?.tagline && (
              <motion.p
                variants={fadeInUp}
                className="mt-5 text-lg sm:text-xl text-gray-500 max-w-xl mx-auto leading-relaxed"
              >
                {branding.tagline}
              </motion.p>
            )}

            <motion.div variants={fadeInUp} className="mt-9">
              <Link
                to={`/schools/${slug}/login`}
                className="inline-block text-white px-8 py-3.5 rounded-2xl font-semibold text-lg shadow-lg hover:opacity-90 hover:-translate-y-0.5 transition-all duration-200"
                style={{ backgroundColor: primary }}
              >
                Login to your account →
              </Link>
            </motion.div>
          </motion.div>
        </section>

        {/* ── School Info Card ───────────────────────────────────────────────── */}
        {(branding?.address || branding?.contactNumber) && (
          <section className="bg-white py-10 px-6">
            <div className="max-w-5xl mx-auto">
              <motion.div
                variants={fadeInUp}
                initial="hidden"
                animate="visible"
                className="rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col sm:flex-row gap-6"
              >
                {branding?.address && (
                  <div className="flex items-start gap-3 flex-1">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-base"
                      style={{ backgroundColor: primary }}
                    >
                      📍
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Address</p>
                      <p className="text-sm text-gray-700 whitespace-pre-line">{branding.address}</p>
                    </div>
                  </div>
                )}
                {branding?.contactNumber && (
                  <div className="flex items-start gap-3 flex-1">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-base"
                      style={{ backgroundColor: primary }}
                    >
                      📞
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Contact</p>
                      <p className="text-sm text-gray-700">{branding.contactNumber}</p>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          </section>
        )}

        {/* ── Announcements ─────────────────────────────────────────────────── */}
        {announcements.length > 0 && (
          <section className="bg-gray-50 py-14 px-6">
            <div className="max-w-5xl mx-auto">
              <motion.div variants={staggerContainer} initial="hidden" animate="visible">
                <motion.h2 variants={fadeInUp} className="text-2xl font-bold text-gray-900 mb-6">
                  Announcements
                </motion.h2>
                <div className="space-y-4">
                  {announcements.map((ann) => (
                    <motion.div
                      key={ann._id}
                      variants={fadeInUp}
                      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 text-base truncate">
                            {ann.title}
                          </h3>
                          <p className="mt-1.5 text-sm text-gray-600 leading-relaxed line-clamp-3">
                            {ann.content}
                          </p>
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0 mt-0.5">
                          {formatDate(ann.publishedAt)}
                        </span>
                      </div>
                      {ann.teacherId?.userId?.name && (
                        <p className="mt-3 text-xs text-gray-400">
                          — {ann.teacherId.userId.name}
                        </p>
                      )}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          </section>
        )}

      </main>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 py-6 bg-white">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs text-gray-400">{schoolName}</span>
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} All rights reserved.</p>
          <Link
            to={`/schools/${slug}/login`}
            className="text-xs font-medium hover:opacity-80 transition-opacity"
            style={{ color: primary }}
          >
            Login →
          </Link>
        </div>
      </footer>
    </div>
  );
}
