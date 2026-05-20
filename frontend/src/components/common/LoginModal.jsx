import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { closeLoginModal, selectLoginModal } from '../../redux/slices/uiSlice';
import LoginForm from './LoginForm';

const overlay = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1 },
  exit:    { opacity: 0 },
};

const panel = {
  hidden:  { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.2 } },
  exit:    { opacity: 0, scale: 0.95 },
};

// Public pages where the modal must never appear
const AUTH_PATHS = ['/login', '/register', '/forgot-password', '/reset-password', '/change-password'];

export default function LoginModal() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { isOpen, redirectTo } = useSelector(selectLoginModal);

  const onAuthPage = AUTH_PATHS.some((p) => location.pathname.startsWith(p));

  // Auto-close if user navigates to a public auth page while modal is open
  useEffect(() => {
    if (isOpen && onAuthPage) {
      dispatch(closeLoginModal());
    }
  }, [isOpen, onAuthPage, dispatch]);

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') dispatch(closeLoginModal());
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, dispatch]);

  const handleSuccess = () => {
    dispatch(closeLoginModal());
    navigate(redirectTo ?? location.pathname, { replace: true });
  };

  const handleCancel = () => dispatch(closeLoginModal());

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="modal-backdrop"
            variants={overlay}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 bg-black/50 z-50"
            onClick={handleCancel}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            key="modal-panel"
            variants={panel}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-label="Sign in"
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white rounded-2xl shadow-2xl p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 text-center">
              <h2 className="text-xl font-bold text-gray-800">Sign in to continue</h2>
              <p className="text-gray-500 text-sm mt-1">Your session has expired</p>
            </div>
            <LoginForm onSuccess={handleSuccess} onCancel={handleCancel} />
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
