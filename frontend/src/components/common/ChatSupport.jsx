import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { selectUser, selectRole } from '../../redux/slices/authSlice';
import {
  selectFeatures,
  selectSubscriptionSummary,
} from '../../redux/slices/subscriptionSlice';
import {
  selectSchoolName,
  selectSchoolSlug,
} from '../../redux/slices/schoolSlice';
import { FEATURES } from '../../utils/features';

/**
 * Tawk.to chat widget bootstrap.
 *
 * Renders no visible JSX — it injects Tawk's embed script on mount and
 * controls visibility via the `Tawk_API` global. Behaviour:
 *
 *   - Only school-admin users whose plan includes the CHAT_SUPPORT feature
 *     ever see the bubble. Other roles, anonymous visitors, and admins on
 *     Starter plans get nothing injected.
 *   - When the user logs out / loses entitlement, we call
 *     `Tawk_API.hideWidget()` so the bubble disappears without a reload.
 *   - User attributes (name, email, school, plan) are forwarded so support
 *     agents see who they're chatting with.
 *   - If `VITE_TAWK_PROPERTY_ID` or `VITE_TAWK_WIDGET_ID` is missing, the
 *     component is a no-op — safe to ship before the Tawk account is set up.
 */

const PROPERTY_ID = import.meta.env.VITE_TAWK_PROPERTY_ID;
const WIDGET_ID = import.meta.env.VITE_TAWK_WIDGET_ID;
const isConfigured = Boolean(PROPERTY_ID && WIDGET_ID);

const tawkLoaded = () =>
  typeof window !== 'undefined' && Boolean(window.Tawk_API && window.Tawk_API.onLoad !== undefined);

const safelyCall = (fnName, ...args) => {
  if (typeof window === 'undefined') return;
  const api = window.Tawk_API;
  if (!api || typeof api[fnName] !== 'function') return;
  try {
    api[fnName](...args);
  } catch {
    // Swallow — chat widget should never break the app.
  }
};

export default function ChatSupport() {
  const role = useSelector(selectRole);
  const user = useSelector(selectUser);
  const features = useSelector(selectFeatures);
  const summary = useSelector(selectSubscriptionSummary);
  const schoolName = useSelector(selectSchoolName);
  const schoolSlug = useSelector(selectSchoolSlug);

  const entitled =
    isConfigured &&
    role === 'school-admin' &&
    Array.isArray(features) &&
    features.includes(FEATURES.CHAT_SUPPORT);

  const injectedRef = useRef(false);

  useEffect(() => {
    if (!isConfigured) return undefined;

    if (!entitled) {
      // If the script was previously loaded (e.g. plan downgraded mid-session),
      // hide the widget instead of leaving it visible.
      safelyCall('hideWidget');
      return undefined;
    }

    // First-time injection
    if (!injectedRef.current && !tawkLoaded()) {
      injectedRef.current = true;
      window.Tawk_API = window.Tawk_API || {};
      window.Tawk_LoadStart = new Date();

      window.Tawk_API.onLoad = function onTawkLoad() {
        if (user) {
          safelyCall('setAttributes', {
            name: user.name,
            email: user.email,
            schoolName: schoolName || '',
            schoolSlug: schoolSlug || '',
            plan: summary?.planType || '',
            billingCycle: summary?.billingCycle || '',
          }, () => {});
        }
      };

      const s = document.createElement('script');
      s.async = true;
      s.src = `https://embed.tawk.to/${PROPERTY_ID}/${WIDGET_ID}`;
      s.charset = 'UTF-8';
      s.setAttribute('crossorigin', '*');
      const first = document.getElementsByTagName('script')[0];
      if (first && first.parentNode) {
        first.parentNode.insertBefore(s, first);
      } else {
        document.body.appendChild(s);
      }
      return undefined;
    }

    // Script already injected — just make sure widget is visible + attributes
    // are fresh.
    safelyCall('showWidget');
    if (user) {
      safelyCall('setAttributes', {
        name: user.name,
        email: user.email,
        schoolName: schoolName || '',
        schoolSlug: schoolSlug || '',
        plan: summary?.planType || '',
        billingCycle: summary?.billingCycle || '',
      }, () => {});
    }
    return undefined;
  }, [entitled, user, schoolName, schoolSlug, summary?.planType, summary?.billingCycle]);

  return null;
}
