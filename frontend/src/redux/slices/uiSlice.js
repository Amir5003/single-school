import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  loading: false,
  toast: { message: '', type: '' }, // type: 'success' | 'error' | 'info'
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
  },
});

export const { setLoading, showToast, clearToast } = uiSlice.actions;

// Selectors
export const selectLoading = (state) => state.ui.loading;
export const selectToast = (state) => state.ui.toast;

export default uiSlice.reducer;
