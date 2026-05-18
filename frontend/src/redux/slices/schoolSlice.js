import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  slug: null,
  name: null,
  branding: {
    logoUrl: null,
    primaryColor: '#1a73e8',
    secondaryColor: '#fbbc04',
    tagline: null,
  },
};

const schoolSlice = createSlice({
  name: 'school',
  initialState,
  reducers: {
    setSchoolConfig: (state, action) => {
      const { slug, name, branding } = action.payload;
      state.slug = slug ?? state.slug;
      state.name = name ?? state.name;
      if (branding) {
        state.branding = { ...state.branding, ...branding };
      }
    },
    clearSchoolConfig: () => initialState,
  },
});

export const { setSchoolConfig, clearSchoolConfig } = schoolSlice.actions;

// Selectors
export const selectSchoolSlug = (state) => state.school.slug;
export const selectSchoolName = (state) => state.school.name;
export const selectSchoolBranding = (state) => state.school.branding;

export default schoolSlice.reducer;
