import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import axiosInstance from '../../api/axiosInstance';
import { selectUser, updateUser } from '../../redux/slices/authSlice';
import { fadeInUp } from '../../utils/animationVariants';

/**
 * One-time acknowledgement by an administrator that their school has a lawful
 * basis for the records it enters and has informed the people concerned.
 *
 * ONCE PER ADMINISTRATOR — never per record created. A dialog that fires every
 * time a student is added becomes muscle memory inside a week and stops being
 * a meaningful acknowledgement of anything.
 *
 * Deliberately not enforced by server middleware on the create routes: what
 * matters evidentially is that the acknowledgement was made and recorded, not
 * that the server refused to act without it. See
 * specs/011-legal-terms-privacy/contracts/legal.api.md §2.
 *
 * Renders `children` once acknowledged (or if already acknowledged).
 */
export default function DataResponsibilityGate({ children, skip = false }) {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (skip || user?.adminDataAckAt) return children;

  const acknowledge = async () => {
    setSaving(true);
    setError('');
    try {
      const { data } = await axiosInstance.post('/admin/legal/ack');
      // Reflect it locally so the gate does not reappear on the next open.
      // updateUser, not setCredentials — the latter would reset role, schoolId
      // and entitlements from an payload that does not carry them.
      dispatch(updateUser({ adminDataAckAt: data.data.adminDataAckAt }));
    } catch {
      setError('Could not record your acknowledgement. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
        <h3 className="text-sm font-semibold text-amber-900 mb-2">
          Before you add people to this school
        </h3>
        <p className="text-xs text-amber-900/90 leading-relaxed">
          Adding a student or teacher creates an account in their name and stores their personal
          details — for a student, that includes their date of birth and home address. Your school,
          not this platform, decides what is recorded and is responsible for having a lawful reason
          to hold it.
        </p>
        <p className="text-xs text-amber-900/90 leading-relaxed mt-2">
          You only need to confirm this once. See the{' '}
          <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="underline font-medium">
            Privacy Notice
          </Link>{' '}
          for what families can be told.
        </p>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="button"
        onClick={acknowledge}
        disabled={saving}
        className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition"
      >
        {saving
          ? 'Saving…'
          : 'I confirm my school has a lawful reason to hold these details and has informed the people concerned'}
      </button>
    </motion.div>
  );
}
