import Navbar from './Navbar';
import Sidebar from './Sidebar';

/**
 * Shell layout shared by all authenticated role dashboards.
 * @param {object} props
 * @param {string} props.role    - 'admin' | 'teacher' | 'student'
 * @param {React.ReactNode} props.children
 */
export default function Layout({ role, children }) {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar role={role} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
