import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { selectUser, selectSchoolSlug, clearCredentials } from '../../redux/slices/authSlice';
import { selectSchoolName, selectSchoolBranding } from '../../redux/slices/schoolSlice';
import { logoutUser } from '../../api/auth.api';
import { clearTokens } from '../../api/tokenStorage';

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
      // tokens cleared regardless
    }
    clearTokens();
    localStorage.removeItem('lastSchoolSlug');  // T051
    dispatch(clearCredentials());
    // replace: true so protected pages are removed from browser history
    navigate('/', { replace: true });
  };

  const displayName = schoolName ?? 'SchoolMS';

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 shrink-0 gap-3">
      <div className="flex items-center gap-2 min-w-0">
        {/* Hamburger — mobile only */}
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="md:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition flex-shrink-0"
            aria-label="Toggle menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        {branding?.logoUrl ? (
          <img src={branding.logoUrl} alt={displayName} className="h-8 w-auto object-contain flex-shrink-0" />
        ) : (
          <span
            className="font-bold text-base tracking-tight truncate"
            style={{ color: branding?.primaryColor ?? '#4f46e5' }}
          >
            {displayName}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* User name — hidden on mobile to prevent overflow */}
        <span className="hidden sm:block text-sm text-gray-600 truncate max-w-[160px]">{user?.name}</span>
        {/* User initial avatar — mobile only */}
        <span className="sm:hidden w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
          {user?.name?.[0]?.toUpperCase() ?? '?'}
        </span>
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
