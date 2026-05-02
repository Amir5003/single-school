const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const fadeInUp = prefersReducedMotion
  ? {}
  : {
      hidden: { opacity: 0, y: 20 },
      visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
      exit: { opacity: 0, y: -10 },
    };

export const staggerContainer = prefersReducedMotion
  ? {}
  : {
      hidden: {},
      visible: { transition: { staggerChildren: 0.1 } },
    };

export const slideInRight = prefersReducedMotion
  ? {}
  : {
      hidden: { opacity: 0, x: 50 },
      visible: { opacity: 1, x: 0 },
    };

export const scaleIn = prefersReducedMotion
  ? {}
  : {
      hidden: { opacity: 0, scale: 0.9 },
      visible: { opacity: 1, scale: 1 },
    };

/**
 * Returns motion props { initial, animate, exit } bound to the provided variant
 * object, or an empty object when prefers-reduced-motion is set.
 */
export function getVariants(variants) {
  if (prefersReducedMotion || !variants || Object.keys(variants).length === 0) {
    return {};
  }
  return { initial: 'hidden', animate: 'visible', exit: 'exit' };
}
