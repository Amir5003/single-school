import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchStart,
  fetchSuccess,
  fetchFailure,
  selectSubscriptionSummary,
  selectSubscriptionPlans,
  selectSubscriptionLoading,
} from '../redux/slices/subscriptionSlice';
import { selectRole } from '../redux/slices/authSlice';
import { getSubscription } from '../api/subscription.api';

/**
 * Subscription data hook for school-admin views.
 *
 * - Fetches /subscription on mount when the current user is a school-admin.
 * - Caches in redux so child components don't re-fetch.
 * - Exposes a `refresh()` helper and a `pollUntilActive()` helper used by
 *   the UpgradeModal after a successful payment.
 */
export default function useSubscription({ autoFetch = true } = {}) {
  const dispatch = useDispatch();
  const role = useSelector(selectRole);
  const summary = useSelector(selectSubscriptionSummary);
  const plans = useSelector(selectSubscriptionPlans);
  const isLoading = useSelector(selectSubscriptionLoading);

  const refresh = useCallback(async () => {
    if (role !== 'school-admin') return null;
    dispatch(fetchStart());
    try {
      const response = await getSubscription();
      dispatch(fetchSuccess(response.data));
      return response.data;
    } catch (err) {
      dispatch(fetchFailure(err?.response?.data?.message || err.message));
      throw err;
    }
  }, [dispatch, role]);

  useEffect(() => {
    if (autoFetch && role === 'school-admin' && !summary) {
      refresh().catch(() => {});
    }
  }, [autoFetch, role, summary, refresh]);

  /**
   * Poll /subscription every `intervalMs` for up to `timeoutMs` waiting for
   * status to become `active`. Resolves with the new summary or rejects with
   * a timeout error.
   */
  const pollUntilActive = useCallback(
    async ({ intervalMs = 1500, timeoutMs = 15000 } = {}) => {
      const startedAt = Date.now();
      // eslint-disable-next-line no-constant-condition
      while (true) {
        try {
          const response = await getSubscription();
          dispatch(fetchSuccess(response.data));
          if (response.data?.subscription?.status === 'active') {
            return response.data.subscription;
          }
        } catch {
          // Swallow and continue polling — the webhook may still be in flight.
        }
        if (Date.now() - startedAt > timeoutMs) {
          throw new Error(
            'Activation is taking longer than expected. Your payment is being processed — refresh in a moment.'
          );
        }
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    },
    [dispatch]
  );

  return {
    summary,
    plans,
    isLoading,
    refresh,
    pollUntilActive,
  };
}
