import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 bg-indigo-50">
      {/* Illustration placeholder */}
      <div className="w-40 h-40 rounded-full bg-indigo-100 flex items-center justify-center mb-8 text-6xl select-none">
        🔍
      </div>

      <h1 className="text-5xl font-extrabold text-gray-900">404</h1>
      <h2 className="mt-2 text-xl font-semibold text-gray-700">Page Not Found</h2>
      <p className="mt-3 text-gray-500 max-w-xs">
        The page you are looking for does not exist or has been moved.
      </p>

      <Link
        to="/"
        className="mt-8 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-2xl shadow hover:bg-indigo-700 transition-colors"
      >
        Go Home
      </Link>
    </div>
  );
}
