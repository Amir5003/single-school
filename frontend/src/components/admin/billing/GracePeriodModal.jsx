import { motion, AnimatePresence } from 'framer-motion';
import Countdown from '../../common/Countdown';

/**
 * Soft warning modal shown on the first visit during grace period. Unlike
 * the expired modal, this one is dismissible — the user can close it for
 * the session, but the banner remains.
 */
export default function GracePeriodModal({ open, onClose, onUpgradeClick, summary }) {
  if (!open || !summary) return null;
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[90] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          className="bg-white max-w-lg w-full rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="h-1.5 bg-gradient-to-r from-orange-500 via-rose-500 to-pink-500" />
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <svg className="h-6 w-6 text-orange-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.515 2.625H3.72c-1.345 0-2.188-1.458-1.515-2.625L8.485 2.495zM10 6a1 1 0 011 1v3a1 1 0 11-2 0V7a1 1 0 011-1zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-orange-600">
                  Trial ended — grace period active
                </p>
                <h2 className="mt-1 text-lg font-bold text-gray-900">
                  Pay before grace ends to avoid interruption
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Your school is still fully usable, but after grace ends, write actions will be blocked across all roles. Read access stays available so your team never loses visibility.
                </p>
              </div>
            </div>

            <div className="mt-5 p-4 rounded-xl bg-gradient-to-r from-orange-50 to-rose-50 border border-orange-100">
              <p className="text-xs font-medium text-orange-700 mb-2">Time remaining</p>
              <Countdown endsAt={summary.graceEndsAt} showSeconds={false} />
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Remind me later
              </button>
              <button
                type="button"
                onClick={onUpgradeClick}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition"
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
