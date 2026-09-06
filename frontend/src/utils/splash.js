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
/**
 * ── ⚠️ ONCE PER DOCUMENT LOAD (PF-106, owner-requested 2026-09-06) ──────
 *
 * The rule: the splash plays on the first open and on a refresh of the home
 * page, and on nothing else. Returning home from /blog — by the nav or by
 * the browser's Back button — must not replay it.
 *
 * Module scope IS the mechanism, not an implementation detail. This
 * variable lives exactly as long as the document does, so:
 *
 *   - a refresh re-evaluates the module, the flag is false again, and the
 *     splash replays — which is the owner's second requirement, for free
 *     and with nothing to expire;
 *   - a client-side navigation does not, so coming back to "/" finds it
 *     already true.
 *
 * ⚠️ NEITHER THE URL NOR THE HISTORY ENTRY CAN DO THIS JOB, measured
 * rather than assumed. React Router's `location.key === 'default'` looks
 * like a clean stateless test for "initial render of this document"; it is
 * not. In the running app:
 *
 *     initial load of "/"     history.state = { idx: 0 }        no key
 *     click through to /blog  history.state = { idx: 1, key: … }
 *     browser Back to "/"     history.state = { idx: 0 }        no key
 *
 * The home entry after a Back is identical to the initial load, so that
 * gate would replay the splash on precisely the journey this ticket exists
 * to stop. `history.state.idx` fails the same way. Runtime state is the
 * only thing that separates them.
 *
 * ⚠️ THE LOCKED WARNING ABOUT A MODULE FLAG STILL STANDS — it names the
 * flag set AT MOUNT, which StrictMode's simulated remount sets on the
 * first mount and reads on the second, so the splash never appears in
 * development. This one is set from `Splash.jsx`'s `finish()`, ~4.5s
 * later. StrictMode tears the discarded first mount down within
 * milliseconds and its effect cleanup clears every pending timer, so
 * `finish()` never runs on it and the flag is still false when the real
 * mount arms. Verified by running the dev server, because a green unit
 * suite says nothing about a dev-only double mount.
 */
let shownThisDocument = false;

/**
 * Called once the splash has finished — by its own timer or by SKIP, which
 * both funnel through `finish()`.
 *
 * At COMPLETION rather than at mount, for the StrictMode reason above. A
 * side effect worth stating: SKIP therefore counts as seen, which is right
 * — dismissing the intro deliberately is still having dealt with it.
 */
export function markSplashShown() {
  shownThisDocument = true;
}

export function shouldShowSplash() {
  // Cheapest check first, and the only one that is not about this visitor's
  // preferences: we have already shown it in this document.
  if (shownThisDocument) return false;

  try {
    if (new URLSearchParams(window.location.search).has('nosplash')) return false;
  } catch {
    /* Prototype line 897 swallows this too. A URL we cannot parse is not
       a reason to skip the splash — fall through and show it. */
  }

  return !prefersReducedMotion();
}
