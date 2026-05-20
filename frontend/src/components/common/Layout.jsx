import { useState } from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

/**
 * Shell layout shared by all authenticated role dashboards.
 * @param {object} props
 * @param {string} props.role    - 'school-admin' | 'teacher' | 'student'
 * @param {React.ReactNode} props.children
 */
export default function Layout({ role, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      <Navbar onMenuToggle={() => setSidebarOpen((o) => !o)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          role={role}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
