import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { motion } from 'framer-motion';
import { getSchoolConfig } from '../api/school.api';
import { setSchoolConfig } from '../redux/slices/schoolSlice';
import { scaleIn, fadeInUp, staggerContainer } from '../utils/animationVariants';

export default function SchoolLanding() {
  const { slug } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    getSchoolConfig(slug)
      .then(({ data }) => {
        if (cancelled) return;
        const schoolData = data.data;
        setSchool(schoolData);
        dispatch(
          setSchoolConfig({
            slug: schoolData.slug,
            name: schoolData.name,
            branding: schoolData.branding,
          })
        );
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.response?.status === 404) {
          setNotFound(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, dispatch]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (notFound) {
    return (
      <motion.div
        variants={scaleIn}
        initial="hidden"
        animate="visible"
        className="min-h-screen flex flex-col items-center justify-center text-center p-8"
      >
        <div className="text-6xl mb-4">🏫</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">School not found</h1>
        <p className="text-gray-500 mb-6">
          This school workspace does not exist or may have been removed.
        </p>
        <Link
          to="/"
          className="inline-block bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Back to home
        </Link>
      </motion.div>
    );
  }

  const { branding } = school;

  return (
    <div
      className="min-h-screen"
      style={{
        '--school-primary': branding?.primaryColor || '#1a73e8',
        '--school-secondary': branding?.secondaryColor || '#fbbc04',
      }}
    >
      {/* Navbar */}
      <nav
        className="py-4 px-6 flex items-center justify-between shadow-sm"
        style={{ backgroundColor: 'var(--school-primary)' }}
      >
        {branding?.logoUrl ? (
          <img src={branding.logoUrl} alt={school.name} className="h-10" />
        ) : (
          <span className="text-white font-bold text-xl">{school.name}</span>
        )}
        <Link
          to={`/schools/${slug}/login`}
          className="bg-white text-sm font-medium px-4 py-2 rounded-lg"
          style={{ color: 'var(--school-primary)' }}
        >
          Login
        </Link>
      </nav>

      {/* Hero */}
      <motion.section
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="flex flex-col items-center justify-center text-center px-6 py-24"
      >
        <motion.h1
          variants={fadeInUp}
          className="text-4xl font-bold text-gray-900 mb-4"
        >
          Welcome to {school.name}
        </motion.h1>

        {branding?.tagline && (
          <motion.p variants={fadeInUp} className="text-xl text-gray-500 mb-8 max-w-xl">
            {branding.tagline}
          </motion.p>
        )}

        <motion.div variants={fadeInUp} className="flex gap-4">
          <Link
            to={`/schools/${slug}/login`}
            className="inline-block text-white px-8 py-3 rounded-xl font-semibold text-lg hover:opacity-90 transition-opacity"
            style={{ backgroundColor: 'var(--school-primary)' }}
          >
            Login
          </Link>
        </motion.div>
      </motion.section>

      {/* Contact info */}
      {(branding?.address || branding?.contactNumber) && (
        <motion.footer
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="border-t py-6 text-center text-sm text-gray-500"
        >
          {branding.address && <p>{branding.address}</p>}
          {branding.contactNumber && <p>Contact: {branding.contactNumber}</p>}
        </motion.footer>
      )}
    </div>
  );
}
