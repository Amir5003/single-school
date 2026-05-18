import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectSchoolSlug } from '../../redux/slices/authSlice';

const activeClass = 'bg-indigo-50 text-indigo-700 font-semibold';
const baseClass   = 'block rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 transition';

export default function Sidebar({ role }) {
  const schoolSlug = useSelector(selectSchoolSlug);
  const base = schoolSlug ? `/schools/${schoolSlug}` : '';

  const NAV_ITEMS = {
    'school-admin': [
      { label: 'Dashboard',         to: `${base}/admin/dashboard` },
      { label: 'Students',          to: `${base}/admin/students` },
      { label: 'Teachers',          to: `${base}/admin/teachers` },
      { label: 'Classes',           to: `${base}/admin/classes` },
      { label: 'Timetable',         to: `${base}/admin/timetable` },
      { label: 'Pending Approvals', to: `${base}/admin/pending-approvals` },
    ],
    teacher: [
      { label: 'Dashboard',      to: `${base}/teacher/dashboard` },
      { label: 'Attendance',     to: `${base}/teacher/attendance` },
      { label: 'Marks',          to: `${base}/teacher/marks` },
      { label: 'Announcements',  to: `${base}/teacher/announcements` },
    ],
    student: [
      { label: 'Dashboard',      to: `${base}/student/dashboard` },
      { label: 'Timetable',      to: `${base}/student/timetable` },
      { label: 'Attendance',     to: `${base}/student/attendance` },
      { label: 'Marks',          to: `${base}/student/marks` },
      { label: 'Announcements',  to: `${base}/student/announcements` },
    ],
    parent: [
      { label: 'Dashboard', to: `${base}/parent/dashboard` },
    ],
    'super-admin': [
      { label: 'Schools',               to: '/platform/schools' },
      { label: 'Pending Registrations', to: '/platform/pending' },
    ],
  };

  const items = NAV_ITEMS[role] || [];

  return (
    <aside className="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col py-4 gap-1 px-3">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => `${baseClass} ${isActive ? activeClass : ''}`}
        >
          {item.label}
        </NavLink>
      ))}
    </aside>
  );
}
