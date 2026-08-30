import { createSlice } from '@reduxjs/toolkit';

const DEFAULT_BRANDING = {
  logoUrl: null,
  primaryColor: '#1a73e8',
  secondaryColor: '#fbbc04',
  tagline: null,
  address: null,
  contactNumber: null,
};

const initialState = {
  slug: null,
  name: null,
  branding: { ...DEFAULT_BRANDING },
};

const schoolSlice = createSlice({
  name: 'school',
  initialState,
  reducers: {
    /**
     * Replace the whole school context. Deliberately a REPLACE, not a merge:
     * the config endpoint returns `school.branding || {}` off a `.lean()` read,
     * so a school whose branding was never written comes back empty. Merging
     * that onto the previous state left the previous school's logo, address and
     * phone number in place under the new school's name.
     *
     * Fields the payload omits fall back to the defaults, never to whatever the
     * last school had.
     */
    setSchoolConfig: (state, action) => {
      const { slug, name, branding } = action.payload ?? {};
      state.slug = slug ?? null;
      state.name = name ?? null;
      state.branding = { ...DEFAULT_BRANDING, ...(branding ?? {}) };
    },
    /**
     * Patch branding only, keeping slug/name — for the admin settings page,
     * which saves branding for the school already in context.
     */
    setSchoolBranding: (state, action) => {
      state.branding = { ...state.branding, ...(action.payload ?? {}) };
    },
    clearSchoolConfig: () => ({ ...initialState, branding: { ...DEFAULT_BRANDING } }),
  },
});

export const { setSchoolConfig, setSchoolBranding, clearSchoolConfig } = schoolSlice.actions;

// Selectors
// NOTE: this is the slug of the school context being *viewed* (from the URL) —
// it is meaningful on public pages with no signed-in user. For "the school the
// signed-in user belongs to", use selectSchoolSlug from authSlice instead.
export const selectSchoolContextSlug = (state) => state.school.slug;
export const selectSchoolName = (state) => state.school.name;
export const selectSchoolBranding = (state) => state.school.branding;

export default schoolSlice.reducer;
