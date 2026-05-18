import { NavLink } from 'react-router-dom';
import Navbar from './Navbar';

const PLATFORM_NAV = [
  { label: 'Schools',               to: '/platform/schools' },
  { label: 'Pending Registrations', to: '/platform/pending' },
];

const activeClass = 'bg-indigo-50 text-indigo-700 font-semibold';
const baseClass   = 'block rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 transition';

/**
 * Shell layout for super-admin platform pages.
 * Includes the shared Navbar at the top and a sidebar with platform nav links.
 */
export default function PlatformLayout({ children }) {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col py-4 gap-1 px-3">
          {PLATFORM_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `${baseClass} ${isActive ? activeClass : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </aside>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
