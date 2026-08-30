import { clearCredentials } from '../redux/slices/authSlice';
import { clearSchoolConfig } from '../redux/slices/schoolSlice';
import { reset as resetSubscription } from '../redux/slices/subscriptionSlice';
import { clearTokens } from '../api/tokenStorage';

/**
 * Tear down every trace of the signed-in user.
 *
 * The school slice and the subscription slice are NOT part of `auth`, so
 * clearing credentials alone left the previous school's slug, name, branding
 * and plan in memory — an SPA logout does no page reload, so they bled into
 * the next sign-in. Every logout path must go through here.
 *
 * @param {import('redux').Dispatch} dispatch
 */
export function resetSession(dispatch) {
  clearTokens();
  try {
    localStorage.removeItem('lastSchoolSlug');
  } catch {
    /* localStorage unavailable — ignore */
  }
  dispatch(clearCredentials());
  dispatch(clearSchoolConfig());
  dispatch(resetSubscription());
}

export default resetSession;
