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
 */
export function SplashProvider({ children, initialReady = true }) {
  const [ready, setReady] = useState(initialReady);
  const value = useMemo(() => ({ ready, setReady }), [ready]);

  return (
    <SplashContext.Provider value={value}>{children}</SplashContext.Provider>
  );
}
