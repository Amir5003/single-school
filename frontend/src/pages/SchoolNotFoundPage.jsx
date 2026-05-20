import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fadeInUp } from '../utils/animationVariants';

export default function SchoolNotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="text-center max-w-md"
      >
        <div className="text-6xl mb-6">🏫</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">School Not Found</h1>
        <p className="text-gray-500 text-sm mb-6">
          We couldn&apos;t find a school with that address. The link may be incorrect or the school may no longer be active.
        </p>
        <Link
          to="/"
          className="inline-block px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition"
        >
          Go to Home
        </Link>
      </motion.div>
    </div>
  );
}
