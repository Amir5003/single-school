import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import uiReducer from './slices/uiSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
  },
});

// Persist auth state to sessionStorage on every store update
store.subscribe(() => {
  const { auth } = store.getState();
  try {
    sessionStorage.setItem('auth', JSON.stringify(auth));
  } catch {
    // Quota or private-browsing errors — fail silently
  }
});

export default store;
