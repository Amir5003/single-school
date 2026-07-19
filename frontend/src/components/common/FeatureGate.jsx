import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { selectFeatures } from '../../redux/slices/subscriptionSlice';
import {
  selectRole,
  selectSchoolSlug,
  selectEntitledFeatures,
} from '../../redux/slices/authSlice';
import Layout from './Layout';

/**
 * Wrap a page in a feature gate. If the school's current plan doesn't
 * include the required feature, render a blocked card instead of the page.
 *
 *  - school-admin: checks the subscription slice (hydrated by
 *    useSubscription) and shows an upgrade prompt with billing CTAs.
 *  - teacher/student: checks the entitlements from the auth payload
 *    (login + /auth/me). They can't upgrade, so the card just points to
 *    the school administrator. When entitlements are unknown (legacy
 *    school / stale session) we fail open and let the backend gate the
 *    underlying API calls.
 *
 * Props:
 *  - feature   string  required FEATURES.* key
 *  - children  ReactNode
 *  - role      string  layout role for the surrounding shell (defaults
 *                      to 'school-admin')
 */
export default function FeatureGate({ feature, children, role = 'school-admin' }) {
  const userRole = useSelector(selectRole);
  const features = useSelector(selectFeatures);
  const entitledFeatures = useSelector(selectEntitledFeatures);
  const schoolSlug = useSelector(selectSchoolSlug);
  const navigate = useNavigate();

  // Non-admin personas: enforce from auth-payload entitlements when known.
  if (userRole !== 'school-admin') {
    if (entitledFeatures === undefined) return children; // unknown → backend gates
    if (entitledFeatures.includes(feature)) return children;
    return (
      <Layout role={role}>
        <div className="max-w-2xl mx-auto mt-12 text-center bg-white rounded-2xl border border-gray-200 shadow-sm p-10">
          <div className="mx-auto h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="h-8 w-8 text-gray-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="mt-5 text-xl font-bold text-gray-900">
            This module isn't available
          </h2>
          <p className="mt-2 text-sm text-gray-600 max-w-md mx-auto">
            The <strong>{feature.replace(/_/g, ' ')}</strong> module isn't included in
            your school's current plan. Please contact your school administrator.
          </p>
          <button
            type="button"
            onClick={() => navigate(`/schools/${schoolSlug}/${role}/dashboard`)}
            className="mt-6 px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-sm"
          >
            Back to dashboard
          </button>
        </div>
      </Layout>
    );
  }

  // Summary not loaded yet — render children, the page itself will show a
  // loading state. Avoids a flash of the upgrade prompt.
  if (!features || features.length === 0) return children;

  if (features.includes(feature)) return children;

  return (
    <Layout role={role}>
      <div className="max-w-2xl mx-auto mt-12 text-center bg-white rounded-2xl border border-gray-200 shadow-sm p-10">
        <div className="mx-auto h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center">
          <svg className="h-8 w-8 text-indigo-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
        </div>
        <h2 className="mt-5 text-xl font-bold text-gray-900">
          This module isn't included in your plan
        </h2>
        <p className="mt-2 text-sm text-gray-600 max-w-md mx-auto">
          The <strong>{feature.replace(/_/g, ' ')}</strong> module is available on the
          Standard and Premium plans. Upgrade your school's plan to unlock it.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => navigate(`/schools/${schoolSlug}/admin/dashboard`)}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Back to dashboard
          </button>
          <button
            type="button"
            onClick={() => navigate(`/schools/${schoolSlug}/admin/billing`)}
            className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-sm"
          >
            View plans
          </button>
        </div>
      </div>
    </Layout>
  );
}
