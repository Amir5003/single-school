import { useSelector } from 'react-redux';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { selectIsAuthenticated, selectRole, selectSchoolSlug } from '../../redux/slices/authSlice';
import { getDashboardPath } from '../../utils/dashboardPath';

export default function ProtectedRoute({ children, allowedRole }) {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const role = useSelector(selectRole);
  const schoolSlug = useSelector(selectSchoolSlug);
  const location = useLocation();
  // Inherited from the parent `/schools/:slug` route; undefined on /platform/*
  const { slug: urlSlug } = useParams();

  if (!isAuthenticated) {
    // Replace so the protected page is not reachable via back button
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRole && role !== allowedRole) {
    // Build a slug-aware fallback dashboard path
    return <Navigate to={getDashboardPath(role, schoolSlug)} replace />;
  }

  // Tenant guard — the URL names a school this user does not belong to. The API
  // is already scoped by the JWT, so the data would be correct while the URL,
  // branding and school name came from somewhere else. Send them to their own.
  if (urlSlug && schoolSlug && urlSlug !== schoolSlug) {
    return <Navigate to={getDashboardPath(role, schoolSlug)} replace />;
  }

  return children;
}
