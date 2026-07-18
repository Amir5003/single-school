import { motion, AnimatePresence } from 'framer-motion';

/**
 * Hard blocking modal for the `expired` and `cancelled` states. The user can
 * either click Upgrade (opens UpgradeModal) or Continue read-only (dismisses
 * for the session but the banner persists).
 */
export default function ExpiredModal({ open, onUpgradeClick, onContinueReadOnly, summary }) {
  if (!open || !summary) return null;
  const isCancelled = summary.status === 'cancelled';
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[90] flex items-center justify-center bg-gray-900/70 backdrop-blur-md p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0, y: 30, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.96 }}
          className="bg-white max-w-lg w-full rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="h-1.5 bg-gradient-to-r from-rose-600 via-pink-600 to-fuchsia-600" />
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                <svg className="h-6 w-6 text-rose-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.707a1 1 0 00-1.414-1.414L9 10.172 7.707 8.879a1 1 0 10-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-rose-600">
                  {isCancelled ? 'Subscription cancelled' : 'Subscription expired'}
                </p>
                <h2 className="mt-1 text-lg font-bold text-gray-900">
                  Your school is now in read-only mode
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Teachers and admins can still log in and view everything, but new attendance, marks, homework, announcements and student creates are blocked. Students and parents continue to access their dashboards.
                </p>
              </div>
            </div>

            <ul className="mt-5 space-y-2 text-xs text-gray-600">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Existing data is safe — nothing is deleted.
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Students and parents keep full read access.
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Admin and teacher write actions are paused.
              </li>
            </ul>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onContinueReadOnly}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Continue read-only
              </button>
              <button
                type="button"
                onClick={onUpgradeClick}
                className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition shadow-sm"
              >
                Upgrade now
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
