import { useSelector } from 'react-redux';

export default function useAuth() {
  const user = useSelector((state) => state.auth.user);
  const role = useSelector((state) => state.auth.role);
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  return { user, role, isAuthenticated };
}
