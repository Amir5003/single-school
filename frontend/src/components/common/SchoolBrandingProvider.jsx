import { createContext, useContext, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { selectSchoolBranding } from '../../redux/slices/schoolSlice';

const BrandingContext = createContext({ prefersReducedMotion: false });

export const useReducedMotion = () => useContext(BrandingContext).prefersReducedMotion;

/**
 * SchoolBrandingProvider
 *
 * Wraps school-scoped routes and injects per-school CSS custom properties onto
 * the wrapping div so child components can reference var(--school-primary) etc.
 * Also detects prefers-reduced-motion and exposes it via BrandingContext.
 */
const SchoolBrandingProvider = ({ children }) => {
  const branding = useSelector(selectSchoolBranding);
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const divRef = useRef(null);

  useEffect(() => {
    if (!divRef.current) return;
    const el = divRef.current;
    if (branding.primaryColor) {
      el.style.setProperty('--school-primary', branding.primaryColor);
    }
    if (branding.secondaryColor) {
      el.style.setProperty('--school-secondary', branding.secondaryColor);
    }
    if (branding.logoUrl) {
      el.style.setProperty('--school-logo', `url(${branding.logoUrl})`);
    }
  }, [branding]);

  return (
    <BrandingContext.Provider value={{ prefersReducedMotion }}>
      <div ref={divRef} className="school-branding-root">
        {children}
      </div>
    </BrandingContext.Provider>
  );
};

export default SchoolBrandingProvider;
