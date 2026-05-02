import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import { selectIsAuthenticated, selectRole } from '../../redux/slices/authSlice';

const ROLE_DASHBOARD = {
  admin: '/admin/dashboard',
  teacher: '/teacher/dashboard',
  student: '/student/dashboard',
};

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

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRole && role !== allowedRole) {
    // Redirect to the user's own dashboard instead of showing a 403 page
    return <Navigate to={ROLE_DASHBOARD[role] || '/login'} replace />;
  }

  return children;
}
