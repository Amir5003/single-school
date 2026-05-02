import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectToast, clearToast } from '../../redux/slices/uiSlice';

const typeStyles = {
  success: 'bg-green-50 text-green-700 border border-green-200',
  error: 'bg-red-50 text-red-700 border border-red-200',
  info: 'bg-blue-50 text-blue-700 border border-blue-200',
};

/**
 * Inline banner.
 * - With `message` prop: renders directly (local state pattern, existing usage).
 * - Without props: reads from Redux uiSlice.toast and auto-clears after 3s.
 */
export default function StatusMessage({ message: propMessage, type: propType = 'success' }) {
  const dispatch = useDispatch();
  const toast = useSelector(selectToast);

  const message = propMessage ?? toast.message;
  const type = propMessage ? propType : (toast.type || 'info');

  useEffect(() => {
    if (!propMessage && toast.message) {
      const id = setTimeout(() => dispatch(clearToast()), 3000);
      return () => clearTimeout(id);
    }
  }, [propMessage, toast.message, dispatch]);

  if (!message) return null;

  return (
    <div className={`rounded-lg px-4 py-3 text-sm font-medium ${typeStyles[type] ?? typeStyles.info}`}>
      {message}
    </div>
  );
}

