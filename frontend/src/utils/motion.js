// frontend/src/utils/motion.js
//
// Reduced-motion detection and application — PF-73.
//
// React-free so it can be unit-tested directly.

export const MOTION_QUERY = '(prefers-reduced-motion: reduce)';
export const MOTION_ATTR  = 'data-motion';

/**
 * Does the user prefer reduced motion?
 *
 * Defaults to FALSE — full motion — when matchMedia is unavailable
 * (older browsers, some test environments). Reduced motion is an
 * explicit opt-in, never something we assume.
 */
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(MOTION_QUERY).matches;
}

/**
 * Reflect the preference on <html>.
 *
 * Sets data-motion="reduced" when reduced, REMOVES the attribute
 * otherwise. Removal rather than data-motion="full" keeps CSS
 * selectors simple — html[data-motion="reduced"] is the only rule
 * needed, and the default path has no attribute selector at all.
 */
export function applyMotionPreference(reduced) {
  if (typeof document === 'undefined') return reduced;

  if (reduced) {
    document.documentElement.setAttribute(MOTION_ATTR, 'reduced');
  } else {
    document.documentElement.removeAttribute(MOTION_ATTR);
  }
  return reduced;
}

/**
 * Subscribe to changes. The user can toggle this in OS settings
 * while the page is open, and it should take effect immediately.
 *
 * Returns an unsubscribe function.
 */
export function subscribeToMotionPreference(callback) {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return () => {};
  }

  const mq = window.matchMedia(MOTION_QUERY);
  const handler = (e) => callback(e.matches);

  // addEventListener is the modern API. addListener is deprecated
  // but still required by Safari < 14, which is old enough to be
  // rare and cheap enough to support.
  if (mq.addEventListener) {
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }

  mq.addListener(handler);
  return () => mq.removeListener(handler);
}
