// frontend/src/hooks/useSplashReady.js
import { useContext } from 'react';
import { SplashContext } from '../providers/SplashContext';

/**
 * Is it safe for scroll-triggered content to start revealing?
 *
 * True whenever there is no splash on the page (the default) or the
 * splash has finished. Reveal and CountUp gate on this because neither
 * IntersectionObserver nor a geometric sweep has any concept of a
 * full-screen overlay painted on top of them — without this, an
 * above-the-fold reveal completes while the splash still covers the
 * screen, and the entrance is gone by the time it lifts.
 *
 * Deliberately does NOT throw outside a SplashProvider — see
 * SplashContext.js.
 */
export function useSplashReady() {
  return useContext(SplashContext).ready;
}
