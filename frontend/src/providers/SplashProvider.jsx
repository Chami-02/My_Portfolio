// frontend/src/providers/SplashProvider.jsx
import { useMemo, useState } from 'react';
import { SplashContext } from './SplashContext';

/**
 * Splash-readiness provider — PF-75, given teeth by PF-78.
 *
 * `initialReady` exists specifically so a page that KNOWS it is about to
 * mount a splash can start `ready` at false from the very first render,
 * instead of starting true and correcting it a render later from the
 * splash's own mount effect. That correction sounds equivalent and is
 * not:
 *
 *   1. First render — context is { ready: true }. Every Reveal/CountUp
 *      on the page renders with splashReady = true.
 *   2. Commit. Every effect in that commit runs with the values that
 *      render produced, including an above-the-fold Reveal arming its
 *      IntersectionObserver right now, under ready = true.
 *   3. The splash's effect, in this same batch, calls setReady(false).
 *      That SCHEDULES a re-render; it cannot retroactively unarm the
 *      observer from step 2.
 *   4. React re-renders, Reveal's effect tears down and re-arms — but
 *      the observer from step 2 was live for a render's worth of real
 *      time, and its callbacks are async, so an element already in view
 *      has a genuine window to fire and complete its entrance behind the
 *      splash.
 *
 * That is exactly the bug PF-75 exists to prevent, reappearing through
 * the gap between "when ready should already be false" and "when the
 * component that knows it gets to say so". With initialReady there is no
 * first render carrying the wrong value, so there is no gap.
 *
 * Defaults to true, so every call site that passes nothing — Admin,
 * Blog, every test written before PF-78 — behaves exactly as it did.
 *
 * ── `resetKey` — PF-88 ────────────────────────────────────────────
 *
 * The footer's REPLAY INTRO button re-runs the splash, so readiness has
 * to close again mid-session. `initialReady` cannot do that: it only
 * SEEDS useState, and remounting this provider to re-seed it would take
 * StarfieldCanvas down with it (it reads useSplashReady, so it lives
 * inside this tree) and regenerate every star behind the splash.
 *
 * ⚠️ Why a render-phase update rather than an effect. This is React's
 * documented "adjusting state when a prop changes" pattern — a setState
 * on THIS component during ITS OWN render, which React resolves by
 * re-rendering this component immediately, before committing any child.
 * An effect would be the exact race SplashProvider's whole doc comment
 * above is about, one layer up: the sections remount in the same commit
 * that raises `resetKey`, so a fresh Reveal would arm its observer under
 * ready:true and have a genuine window to fire behind the splash before
 * the effect's setState landed. The render-phase update closes the gate
 * in the same commit the sections mount in, so that window never opens.
 *
 * It is deliberately NOT `useEffect`, and deliberately not a `key` on
 * this component. Both alternatives were considered and both break
 * something documented elsewhere in this file.
 */
export function SplashProvider({ children, initialReady = true, resetKey = 0 }) {
  const [ready, setReady] = useState(initialReady);

  // Render-phase adjustment. `seenResetKey` tracks the last value acted
  // on, so this fires once per change and not on every render.
  const [seenResetKey, setSeenResetKey] = useState(resetKey);
  if (resetKey !== seenResetKey) {
    setSeenResetKey(resetKey);
    setReady(false);
  }

  const value = useMemo(() => ({ ready, setReady }), [ready]);

  return (
    <SplashContext.Provider value={value}>{children}</SplashContext.Provider>
  );
}
