import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setSchoolConfig, selectSchoolBranding } from '../redux/slices/schoolSlice';
import { getSchoolConfig } from '../api/school.api';

/**
 * useSchoolBranding
 *
 * On mount, fetches the school config for the given slug and dispatches
 * setSchoolConfig to Redux so SchoolBrandingProvider can apply CSS vars.
 *
 * @param {string} slug - School slug from the URL (:slug param)
 * @returns {{ branding: object, isLoading: boolean }}
 */
const useSchoolBranding = (slug) => {
  const dispatch = useDispatch();
  const branding = useSelector(selectSchoolBranding);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setIsLoading(true);
    getSchoolConfig(slug)
      .then((res) => {
        const school = res.data?.data?.school;
        if (school) {
          dispatch(setSchoolConfig({ slug: school.slug, name: school.name, branding: school.branding }));
        }
      })
      .catch(() => {
        // Non-fatal — branding stays at defaults if fetch fails
      })
      .finally(() => setIsLoading(false));
  }, [slug, dispatch]);

  return { branding, isLoading };
};

export default useSchoolBranding;
