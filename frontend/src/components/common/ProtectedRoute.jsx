import { useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';
import { selectIsAuthenticated, selectRole, selectSchoolSlug } from '../../redux/slices/authSlice';

export default function ProtectedRoute({ children, allowedRole }) {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const role = useSelector(selectRole);
  const schoolSlug = useSelector(selectSchoolSlug);
  const location = useLocation();

  if (!isAuthenticated) {
    // Replace so the protected page is not reachable via back button
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRole && role !== allowedRole) {
    // Build a slug-aware fallback dashboard path
    let fallback = '/login';
    if (role === 'super-admin') fallback = '/platform/schools';
    else if (schoolSlug) {
      const base = `/schools/${schoolSlug}`;
      if (role === 'school-admin') fallback = `${base}/admin/dashboard`;
      else if (role === 'teacher')  fallback = `${base}/teacher/dashboard`;
      else if (role === 'student')  fallback = `${base}/student/dashboard`;
      else if (role === 'parent')   fallback = `${base}/parent/dashboard`;
    }
    return <Navigate to={fallback} replace />;
  }

  return children;
}
