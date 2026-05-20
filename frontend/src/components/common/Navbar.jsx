import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { selectUser, selectSchoolSlug, clearCredentials } from '../../redux/slices/authSlice';
import { selectSchoolName, selectSchoolBranding } from '../../redux/slices/schoolSlice';
import { logoutUser } from '../../api/auth.api';

export default function Navbar({ onMenuToggle }) {
  const user         = useSelector(selectUser);
  const schoolName   = useSelector(selectSchoolName);
  const branding     = useSelector(selectSchoolBranding);
  const schoolSlug   = useSelector(selectSchoolSlug);
  const dispatch     = useDispatch();
  const navigate     = useNavigate();

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch {
      // cookie is cleared regardless
    }
    localStorage.removeItem('lastSchoolSlug');  // T051
    dispatch(clearCredentials());
    // replace: true so protected pages are removed from browser history
    navigate('/', { replace: true });
  };

  const displayName = schoolName ?? 'SchoolMS';

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 shrink-0">
      <div className="flex items-center gap-2">
        {/* Hamburger — mobile only */}
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="md:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition"
            aria-label="Toggle menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        {branding?.logoUrl ? (
          <img src={branding.logoUrl} alt={displayName} className="h-8 w-auto object-contain" />
        ) : (
          <span
            className="font-bold text-lg tracking-tight"
            style={{ color: branding?.primaryColor ?? '#4f46e5' }}
          >
            {displayName}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">{user?.name}</span>
        <button
          onClick={handleLogout}
          className="text-sm text-red-500 hover:text-red-700 font-medium transition"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
