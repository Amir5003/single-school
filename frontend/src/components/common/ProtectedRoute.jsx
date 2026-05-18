import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import { selectIsAuthenticated, selectRole, selectSchoolSlug } from '../../redux/slices/authSlice';

/**
 * Wraps a route that requires authentication and optionally a specific role.
 *
 * @param {object}  props
 * @param {React.ReactNode} props.children   - Content to render when authorized
 * @param {string}  [props.allowedRole]      - If set, only this role is permitted
 */
export default function ProtectedRoute({ children, allowedRole }) {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const role = useSelector(selectRole);
  const schoolSlug = useSelector(selectSchoolSlug);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
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
