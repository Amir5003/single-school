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
    },
    clearCredentials: (state) => {
      state.user = null;
      state.role = null;
      state.isAuthenticated = false;
      state.schoolId = null;
      state.schoolSlug = null;
    },
  },
});

export const { setCredentials, clearCredentials } = authSlice.actions;

// Selectors
export const selectUser = (state) => state.auth.user;
export const selectRole = (state) => state.auth.role;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectSchoolId = (state) => state.auth.schoolId;
export const selectSchoolSlug = (state) => state.auth.schoolSlug;

export default authSlice.reducer;
