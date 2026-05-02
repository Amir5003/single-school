import { NavLink } from 'react-router-dom';

const NAV_ITEMS = {
  admin: [
    { label: 'Dashboard', to: '/admin/dashboard' },
    { label: 'Students', to: '/admin/students' },
    { label: 'Teachers', to: '/admin/teachers' },
    { label: 'Classes', to: '/admin/classes' },
    { label: 'Timetable', to: '/admin/timetable' },
    { label: 'Announcements', to: '/admin/announcements' },
    { label: 'Pending Approvals', to: '/admin/pending-approvals' },
  ],
  teacher: [
    { label: 'Dashboard', to: '/teacher/dashboard' },
    { label: 'Attendance', to: '/teacher/attendance' },
    { label: 'Marks', to: '/teacher/marks' },
    { label: 'Announcements', to: '/teacher/announcements' },
  ],
  student: [
    { label: 'Dashboard', to: '/student/dashboard' },
    { label: 'Timetable', to: '/student/timetable' },
    { label: 'Attendance', to: '/student/attendance' },
    { label: 'Marks', to: '/student/marks' },
    { label: 'Announcements', to: '/student/announcements' },
  ],
};

const activeClass =
  'bg-indigo-50 text-indigo-700 font-semibold';
const baseClass =
  'block rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 transition';

export default function Sidebar({ role }) {
  const items = NAV_ITEMS[role] || [];

  return (
    <aside className="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col py-4 gap-1 px-3">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `${baseClass} ${isActive ? activeClass : ''}`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </aside>
  );
}
