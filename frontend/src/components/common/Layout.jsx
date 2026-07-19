import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import SubscriptionGate from './SubscriptionGate';
import ChatSupport from './ChatSupport';
import { getCurrentUser } from '../../api/auth.api';
import { setEntitlements } from '../../redux/slices/authSlice';

// Refresh feature entitlements once per app load — sessions are restored from
// sessionStorage, so a stale session (trial expired overnight, admin upgraded
// the plan) would otherwise keep old entitlements until the next login.
let entitlementsRefreshed = false;

/**
 * Shell layout shared by all authenticated role dashboards.
 * @param {object} props
 * @param {string} props.role    - 'school-admin' | 'teacher' | 'student'
 * @param {React.ReactNode} props.children
 */
export default function Layout({ role, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const dispatch = useDispatch();

  useEffect(() => {
    if (entitlementsRefreshed) return;
    entitlementsRefreshed = true;
    getCurrentUser()
      .then((res) => {
        if (res?.data?.entitlements !== undefined) {
          dispatch(setEntitlements(res.data.entitlements));
        }
      })
      .catch(() => {
        // Fire-and-forget — backend middleware still enforces access.
      });
  }, [dispatch]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      <Navbar onMenuToggle={() => setSidebarOpen((o) => !o)} />
      <SubscriptionGate />
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
      <ChatSupport />
    </div>
  );
}
