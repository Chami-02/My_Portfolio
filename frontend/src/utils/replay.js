// frontend/src/utils/replay.js
//
// The footer's REPLAY INTRO button — PF-88.
//
// React-free, so it can be unit-tested directly and so the one part of
// the behaviour that is a real correctness decision does not hide inside
// a component. Same convention as utils/theme.js, utils/motion.js,
// utils/splash.js, utils/nav.js and utils/parallax.js.
//
// The prototype's handler (Portfolio Revolution.dc.html line 1147):
//
//   replay: () => {
//     window.scrollTo({ top: 0, behavior: 'smooth' });
//     this.setState({ splash: true }, () => { this.hideReveals(); this.runSplash(); });
//   }
//
// The scroll is this module. `splash: true` and the hideReveals() /
// runSplash() pair are App.jsx's counter and HomePage's keyed remount.

import { prefersReducedMotion } from './motion';

/**
 * Scroll back to the top for a replay, and say whether a splash should
 * follow.
 *
 * ⚠️ THE `behavior` ARGUMENT IS THE WHOLE POINT OF THIS FUNCTION.
 *
 * An anchor jump inherits `scroll-behavior` from the root element, so
 * motion.css's root-element override turns it instant under
 * prefers-reduced-motion. A JS `scrollTo` with an EXPLICIT `behavior`
 * ignores that override entirely — the prototype's hardcoded `'smooth'`
 * would animate the jump for exactly the users who asked it not to, and
 * invisibly to anyone not testing with reduce on. This is the same gap
 * ScrollToHash avoids by passing no `behavior` at all; here there is no
 * such option, because there is no element to scroll into view.
 *
 * ⚠️ And it returns FALSE under reduced motion, so no splash runs.
 * The splash is almost nothing but motion — orbiting dots, two spinning
 * rings, a flickering accent, a breathing portrait — and
 * utils/splash.js already routes that preference through the skip path
 * on a cold load. Replay reuses that decision rather than making a
 * second one. Leaving the counter alone also leaves every Reveal where
 * it is, which is what the preference asks for.
 *
 * ⚠️ It does NOT consult `?nosplash`. That param is the prototype's own
 * dev/QA escape hatch for the AUTOMATIC splash on load (line 897, and
 * the convention utils/nav.js uses for every off-home link home). A
 * click on a button labelled REPLAY INTRO is an explicit request, and
 * suppressing it would make the button silently inert for anyone who
 * arrived from the blog.
 *
 * Reads the preference at CLICK time. That is safe where re-deriving it
 * during render is not — see HomePage's frozen shouldShowSplash().
 *
 * @returns {boolean} true if a splash should be replayed.
 */
export function beginReplay() {
  const reduced = prefersReducedMotion();

  if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  }

  return !reduced;
}
