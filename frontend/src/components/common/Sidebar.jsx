import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectSchoolSlug, selectEntitledFeatures } from '../../redux/slices/authSlice';
import { selectSchoolName, selectSchoolBranding } from '../../redux/slices/schoolSlice';
import { selectFeatures } from '../../redux/slices/subscriptionSlice';
import { FEATURES } from '../../utils/features';

const activeClass = 'bg-indigo-50 text-indigo-700 font-semibold';
const baseClass   = 'block rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 transition';

export default function Sidebar({ role, isOpen = false, onClose = () => {} }) {
  const schoolSlug = useSelector(selectSchoolSlug);
  const schoolName = useSelector(selectSchoolName);
  const branding   = useSelector(selectSchoolBranding);
  const features   = useSelector(selectFeatures);
  const entitledFeatures = useSelector(selectEntitledFeatures);
  const base = schoolSlug ? `/schools/${schoolSlug}` : '';

  // `requires` is checked against the school's entitled features list.
  //  - school-admin: hard check on the subscription slice (hydrated by
  //    useSubscription on admin pages).
  //  - other roles: check the entitlements delivered in the auth payload
  //    (login + /auth/me refresh). Fail open ONLY when entitlements are
  //    unknown (legacy school / stale session) — the backend's
  //    checkFeatureAccess middleware remains the enforcement layer.
  const hasFeature = (feature) => {
    if (!feature) return true;
    if (role === 'school-admin') return features.includes(feature);
    if (entitledFeatures === undefined) return true;
    return entitledFeatures.includes(feature);
  };

  const NAV_ITEMS = {
    'school-admin': [
      { label: 'Dashboard',         to: `${base}/admin/dashboard` },
      { label: 'Students',          to: `${base}/admin/students` },
      { label: 'Teachers',          to: `${base}/admin/teachers` },
      { label: 'Classes',           to: `${base}/admin/classes` },
      { label: 'Timetable',         to: `${base}/admin/timetable` },
      { label: 'Exams',             to: `${base}/admin/exams`, requires: FEATURES.EXAMS_RESULTS },
      { label: 'Fees',              to: `${base}/admin/fees` },
      { label: 'Pending Approvals', to: `${base}/admin/pending-approvals` },
      { label: 'School Settings',   to: `${base}/admin/settings` },
      { label: 'Billing',           to: `${base}/admin/billing` },
    ],
    teacher: [
      { label: 'Dashboard',      to: `${base}/teacher/dashboard` },
      { label: 'Attendance',     to: `${base}/teacher/attendance` },
      { label: 'Marks',          to: `${base}/teacher/marks`, requires: FEATURES.EXAMS_RESULTS },
      { label: 'My Exams',       to: `${base}/teacher/my-exams`, requires: FEATURES.EXAMS_RESULTS },
      { label: 'Announcements',  to: `${base}/teacher/announcements` },
    ],
    student: [
      { label: 'Dashboard',      to: `${base}/student/dashboard` },
      { label: 'Profile',        to: `${base}/student/profile` },
      { label: 'Timetable',      to: `${base}/student/timetable` },
      { label: 'Attendance',     to: `${base}/student/attendance` },
      { label: 'Marks',          to: `${base}/student/marks`, requires: FEATURES.EXAMS_RESULTS },
      { label: 'My Results',     to: `${base}/student/results`, requires: FEATURES.EXAMS_RESULTS },
      { label: 'Announcements',  to: `${base}/student/announcements` },
    ],
    parent: [
      { label: 'Dashboard', to: `${base}/parent/dashboard` },
    ],
    'super-admin': [
      { label: 'Schools',               to: '/platform/schools' },
      { label: 'Pending Registrations', to: '/platform/pending' },
      { label: 'Subscriptions',         to: '/platform/subscriptions' },
    ],
  };

  const items = (NAV_ITEMS[role] || []).filter((item) => hasFeature(item.requires));

  return (
    <>
      {/* Dark backdrop — mobile only, closes sidebar on tap */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={[
          // mobile: fixed drawer below the navbar (top-14 = h-14 navbar)
          'fixed top-14 bottom-0 left-0 z-50 w-56 shrink-0',
          'bg-white border-r border-gray-200 flex flex-col py-4 gap-1 px-3 overflow-y-auto',
          'transition-transform duration-200 ease-in-out',
          // desktop: back in normal flex flow, always visible
          'md:static md:top-auto md:bottom-auto md:z-auto md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* School header (T048) */}
        {schoolName && (
          <div className="flex items-center gap-2 px-3 py-2 mb-2 border-b border-gray-100">
            {branding?.logoUrl ? (
              <img src={branding.logoUrl} alt={schoolName} className="h-7 w-auto object-contain shrink-0" />
            ) : (
              <span
                className="w-7 h-7 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ backgroundColor: branding?.primaryColor ?? '#4f46e5' }}
              >
                {schoolName.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="text-xs font-semibold text-gray-700 truncate">{schoolName}</span>
          </div>
        )}
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) => `${baseClass} ${isActive ? activeClass : ''}`}
          >
            {item.label}
          </NavLink>
        ))}

        {/* Branding footer — only shown when at least one field is set */}
        {(branding?.tagline || branding?.contactNumber || branding?.address) && (
          <div className="mt-auto pt-3 border-t border-gray-100 px-1 space-y-1">
            {branding.tagline && (
              <p className="text-xs italic text-gray-400 truncate">{branding.tagline}</p>
            )}
            {branding.contactNumber && (
              <p className="text-xs text-gray-400">📞 {branding.contactNumber}</p>
            )}
            {branding.address && (
              <p className="text-xs text-gray-400 line-clamp-2">📍 {branding.address}</p>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
