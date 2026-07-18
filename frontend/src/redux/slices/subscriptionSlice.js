import { createSlice } from '@reduxjs/toolkit';

const SESSION_KEY = 'subscriptionDismissed';

const loadDismissed = () => {
  try {
    return sessionStorage.getItem(SESSION_KEY) === 'true';
  } catch {
    return false;
  }
};

const initialState = {
  summary: null, // SubscriptionSummary (see backend controller buildSummary)
  plans: [],
  isLoading: false,
  error: null,
  lastFetchedAt: null,
  modalDismissed: loadDismissed(),
};

const slice = createSlice({
  name: 'subscription',
  initialState,
  reducers: {
    fetchStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    fetchSuccess: (state, action) => {
      state.summary = action.payload.subscription;
      state.plans = action.payload.plans || [];
      state.lastFetchedAt = Date.now();
      state.isLoading = false;
      state.error = null;
    },
    fetchFailure: (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    },
    setSummary: (state, action) => {
      state.summary = action.payload;
    },
    dismissModal: (state) => {
      state.modalDismissed = true;
      try {
        sessionStorage.setItem(SESSION_KEY, 'true');
      } catch {
        // sessionStorage may be unavailable
      }
    },
    resetDismissal: (state) => {
      state.modalDismissed = false;
      try {
        sessionStorage.removeItem(SESSION_KEY);
      } catch {
        // ignore
      }
    },
    reset: () => ({ ...initialState, modalDismissed: false }),
  },
});

export const {
  fetchStart,
  fetchSuccess,
  fetchFailure,
  setSummary,
  dismissModal,
  resetDismissal,
  reset,
} = slice.actions;

// ── Selectors ────────────────────────────────────────────────────────────────

export const selectSubscriptionSummary = (state) => state.subscription.summary;
export const selectSubscriptionPlans = (state) => state.subscription.plans;
export const selectSubscriptionLoading = (state) => state.subscription.isLoading;
export const selectSubscriptionDismissed = (state) =>
  state.subscription.modalDismissed;

export const selectSubscriptionStatus = (state) =>
  state.subscription.summary?.status || null;

export const selectIsExpired = (state) =>
  state.subscription.summary?.status === 'expired' ||
  state.subscription.summary?.status === 'cancelled';

export const selectIsBlocking = (state) => {
  const status = state.subscription.summary?.status;
  return status === 'expired' || status === 'cancelled';
};

export const selectIsTrialLimitReached = (state) =>
  state.subscription.summary?.status === 'trial_limit_reached';

export const selectIsGrace = (state) =>
  state.subscription.summary?.status === 'grace_period';

// Entitled-feature selectors. The backend already evaluates trial → all
// features and active → plan features; the frontend just reads the array.
export const selectFeatures = (state) =>
  state.subscription.summary?.features || [];

export const selectHasFeature = (feature) => (state) =>
  Boolean(state.subscription.summary?.features?.includes(feature));

export default slice.reducer;
