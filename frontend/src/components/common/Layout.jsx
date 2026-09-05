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
    <div className="app-shell flex flex-col overflow-hidden bg-gray-50">
      <Navbar onMenuToggle={() => setSidebarOpen((o) => !o)} />
      <SubscriptionGate />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          role={role}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        {/* min-w-0: without it this flex item cannot shrink below its content's
            min-content width, so a wide row pushes the whole page sideways.
            overscroll-contain: stops a flick that reaches the end of this
            pane from chaining to the document and rubber-banding the shell,
            which reads as the scroll snagging. */}
        <main className="flex-1 min-w-0 overflow-y-auto overscroll-contain px-4 pt-4 pb-safe md:px-6 md:pt-6">
          {children}
        </main>
      </div>
      <ChatSupport />
    </div>
  );
}
