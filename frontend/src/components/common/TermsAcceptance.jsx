import { Link } from 'react-router-dom';

/**
 * The school's acceptance of the Terms, shown at registration.
 *
 * Deliberately never pre-ticked: a pre-ticked box is not acceptance in most
 * jurisdictions. The server enforces this independently — see
 * backend/src/validators/onboarding.validator.js — so a caller that skips this
 * component still cannot register a school without acceptance.
 *
 * Links open in a new tab so a half-filled registration form is not lost.
 */
export default function TermsAcceptance({ checked, onChange }) {
  return (
    <label className="flex gap-3 items-start cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-2 focus:ring-indigo-400"
      />
      <span className="text-xs text-gray-600 leading-relaxed">
        I have read and agree to the{' '}
        <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">
          Privacy Notice
        </Link>
        . I am authorised to accept them for this school, and I understand the school is responsible
        for the student, parent and staff data it enters — including telling those people, or their
        guardians, that their records are held here.
      </span>
    </label>
  );
}
