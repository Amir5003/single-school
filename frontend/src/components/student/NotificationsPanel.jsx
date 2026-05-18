import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { staggerContainer, fadeInUp } from '../../utils/animationVariants';
import { listNotifications, markNotificationRead } from '../../api/notification.api';
import { useSelector } from 'react-redux';

const NotificationsPanel = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const role = useSelector((state) => state.auth.user?.role);

  useEffect(() => {
    if (!role) return;
    listNotifications(role)
      .then((res) => setNotifications(res.data?.notifications ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [role]);

  const handleRead = async (notif) => {
    if (notif.readBy?.includes(notif._currentUserId)) return;
    try {
      const res = await markNotificationRead(role, notif._id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === notif._id ? res.data.notification : n))
      );
    } catch {
      // best-effort
    }
  };

  const unreadCount = notifications.filter((n) => !n._isRead).length;

  if (loading) return <p className="text-sm text-gray-500">Loading notifications…</p>;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-lg font-semibold text-gray-800">Notifications</h2>
        {unreadCount > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
            {unreadCount}
          </span>
        )}
      </div>

      <AnimatePresence>
        {notifications.length === 0 ? (
          <p className="text-sm text-gray-500">No notifications.</p>
        ) : (
          <motion.ul
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="space-y-2"
          >
            {notifications.map((notif) => (
              <motion.li
                key={notif._id}
                variants={fadeInUp}
                className="bg-white rounded-lg shadow p-3 cursor-pointer hover:bg-gray-50"
                onClick={() => handleRead(notif)}
              >
                <p className="font-medium text-gray-800">{notif.title}</p>
                <p className="text-sm text-gray-600">{notif.body}</p>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationsPanel;
