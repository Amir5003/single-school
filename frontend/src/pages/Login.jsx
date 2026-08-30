import { Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import LoginForm from '../components/common/LoginForm';
import { getDashboardPath, isForeignSchoolPath } from '../utils/dashboardPath';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams();
  // If redirected here by ProtectedRoute, restore original destination
  const from = location.state?.from?.pathname ?? null;

  const handleSuccess = (user) => {
    const resolvedSlug = user.schoolId?.slug ?? null;
    // Discard a `from` that belongs to a different school — ProtectedRoute
    // captured it for whoever was signed in before, not for this user.
    const dest =
      from && !isForeignSchoolPath(from, resolvedSlug)
        ? from
        : getDashboardPath(user.role, resolvedSlug);
    navigate(dest, { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        {slug && (
          <Link
            to={`/schools/${slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600 transition-colors mb-4"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to school page
          </Link>
        )}
        <div className="bg-white rounded-2xl shadow-md p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-800">School Management</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to your account</p>
        </div>

        <LoginForm onSuccess={handleSuccess} />

        <p className="mt-6 text-center text-sm text-gray-500">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-indigo-600 hover:underline font-medium">
            Register
          </Link>
        </p>
        </div>
      </div>
    </div>
  );
}
