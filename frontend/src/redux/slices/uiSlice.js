import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  loading: false,
  toast: { message: '', type: '' }, // type: 'success' | 'error' | 'info'
  loginModal: { isOpen: false, redirectTo: null },
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    showToast: (state, action) => {
      state.toast = {
        message: action.payload.message,
        type: action.payload.type || 'info',
      };
    },
    clearToast: (state) => {
      state.toast = { message: '', type: '' };
    },
    openLoginModal: (state, action) => {
      state.loginModal.isOpen = true;
      state.loginModal.redirectTo = action.payload?.redirectTo ?? null;
    },
    closeLoginModal: (state) => {
      state.loginModal.isOpen = false;
      state.loginModal.redirectTo = null;
    },
  },
});

export const { setLoading, showToast, clearToast, openLoginModal, closeLoginModal } = uiSlice.actions;

// Selectors
export const selectLoading = (state) => state.ui.loading;
export const selectToast = (state) => state.ui.toast;
export const selectLoginModal = (state) => state.ui.loginModal;

export default uiSlice.reducer;
