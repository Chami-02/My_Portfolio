// frontend/src/utils/splash.js
//
// Should the splash render at all? — PF-78.
//
// React-free so it can be unit-tested directly, same convention as
// utils/theme.js and utils/motion.js.

import { prefersReducedMotion } from './motion';

/**
 * Neither check below exists in the prototype. Confirmed by grep against
 * `docs/design/Portfolio Revolution.dc.html`: zero matches for
 * `sessionStorage` (the splash runs on EVERY load, there is no
 * repeat-visitor gate) and zero for `prefers-reduced-motion`. So:
 *
 *   - `?nosplash` IS the prototype's own escape hatch (line 897), reused
 *     here verbatim as a dev/QA one.
 *   - Reduced motion is this project's decision, not a transcription. It
 *     routes through the same skip path rather than inventing a static
 *     splash presentation: the splash is almost entirely motion —
 *     orbiting dots, two spinning rings, a flickering accent,
 *     a breathing portrait — so there is very little left once motion is
 *     removed, and reusing a behaviour the design already defines beats
 *     designing a new one from nothing.
 *
 * The 120ms delay the prototype's own skip path uses (`startReveals(120)`)
 * is deliberately NOT reproduced. SplashProvider's default of
 * `ready: true` already means zero artificial delay when no splash
 * renders at all, which is the more honest reading of "the user does not
 * want this experience."
 *
 * Reads the OS preference through utils/motion.js rather than calling
 * matchMedia directly, so the media query string lives in exactly one
 * place. That function already defaults to false when matchMedia is
 * missing — reduced motion is an explicit opt-in, never assumed, so a
 * browser that cannot answer the question still gets the splash.
 *
 * @returns {boolean}
 */
export function shouldShowSplash() {
  try {
    if (new URLSearchParams(window.location.search).has('nosplash')) return false;
  } catch {
    /* Prototype line 897 swallows this too. A URL we cannot parse is not
       a reason to skip the splash — fall through and show it. */
  }

  return !prefersReducedMotion();
}
