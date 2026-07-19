import { createSlice } from '@reduxjs/toolkit';

const SESSION_KEY = 'auth';

const loadFromSession = () => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const persisted = loadFromSession();

const initialState = persisted || {
  user: null,
  role: null,
  isAuthenticated: false,
  schoolId: null,
  schoolSlug: null,
  // School feature entitlements from the auth payload:
  // { status, planType, features: [] } — null means "unknown" (legacy school
  // or older session), in which case gates fail open and the backend decides.
  entitlements: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      state.user = action.payload.user;
      state.role = action.payload.role;
      state.isAuthenticated = true;
      state.schoolId = action.payload.schoolId ?? null;
      state.schoolSlug = action.payload.schoolSlug ?? null;
      state.entitlements = action.payload.entitlements ?? null;
    },
    setEntitlements: (state, action) => {
      state.entitlements = action.payload ?? null;
    },
    clearCredentials: (state) => {
      state.user = null;
      state.role = null;
      state.isAuthenticated = false;
      state.schoolId = null;
      state.schoolSlug = null;
      state.entitlements = null;
    },
  },
});

export const { setCredentials, setEntitlements, clearCredentials } = authSlice.actions;

// Selectors
export const selectUser = (state) => state.auth.user;
export const selectRole = (state) => state.auth.role;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectSchoolId = (state) => state.auth.schoolId;
export const selectSchoolSlug = (state) => state.auth.schoolSlug;
// undefined = unknown (fail open); array = authoritative feature list
export const selectEntitledFeatures = (state) =>
  state.auth.entitlements?.features ?? undefined;

export default authSlice.reducer;
