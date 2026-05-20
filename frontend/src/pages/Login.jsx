import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import LoginForm from '../components/common/LoginForm';
import { selectRole, selectSchoolSlug } from '../redux/slices/authSlice';

function getDashboardPath(role, schoolSlug) {
  if (role === 'super-admin') return '/platform/schools';
  if (!schoolSlug) return '/';
  const base = `/schools/${schoolSlug}`;
  if (role === 'school-admin') return `${base}/admin/dashboard`;
  if (role === 'teacher')      return `${base}/teacher/dashboard`;
  if (role === 'student')      return `${base}/student/dashboard`;
  if (role === 'parent')       return `${base}/parent/dashboard`;
  return '/';
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  // If redirected here by ProtectedRoute, restore original destination
  const from = location.state?.from?.pathname ?? null;

  const handleSuccess = (user) => {
    const slug = user.schoolId?.slug ?? null;
    const dest = from ?? getDashboardPath(user.role, slug);
    navigate(dest, { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">
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
  );
}
