// frontend/src/components/layout/ScrollToHash.jsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSplashReady } from '../../hooks/useSplashReady';

/**
 * Scroll to `location.hash` after a react-router navigation — 2026-08-22.
 *
 * ⚠️ WHY THIS EXISTS. React Router v7 performs the navigation and then
 * ignores the fragment entirely; `<Link to="/#projects">` changes the
 * URL and leaves the viewport at the top. Nothing else in this repo
 * handles a hash — ScrollToTop.jsx is a scroll-to-top BUTTON, not a
 * route effect. Without this, the route-aware navbar's off-home links
 * would navigate home and stop.
 *
 * `scrollIntoView()` rather than a computed `window.scrollTo`: it
 * honours `scroll-margin-top`, so the 71px header offset comes from
 * --header-h on each section (PF-79/PF-80) instead of being
 * re-implemented here and drifting from the token.
 *
 * ⚠️ NOT gated on `?nosplash`. This runs whenever a hash is present,
 * including a cold load of `/#projects` with the splash up — see the
 * splash note below for why that is the right call and what it looks
 * like.
 */
export function ScrollToHash() {
  const { hash, key } = useLocation();
  const splashReady = useSplashReady();

  useEffect(() => {
    if (!hash) return undefined;

    // ⚠️ Gated on splash readiness, not merely delayed.
    //
    // A cold link to /#projects with no ?nosplash mounts the splash AND
    // wants to scroll. Scrolling behind a z-index-100 overlay puts the
    // page mid-document before the user has seen the top of it, and
    // every Reveal is still held by initialReady={false} — so the splash
    // lifts onto a mid-page view whose entrances then arm from there.
    // Waiting for the gate means the jump happens on the frame the
    // splash releases, which is the same instant the reveals arm.
    //
    // `useSplashReady()` defaults to `true` outside a SplashProvider
    // (SplashContext's documented fail-open), so on every route that
    // never carries a splash this is a no-op guard rather than a
    // deadlock.
    if (!splashReady) return undefined;

    let raf = null;
    // One frame, so the newly-committed route has laid out and the
    // target exists to be measured. Cancelled on cleanup rather than
    // left to fire against an unmounted tree.
    raf = requestAnimationFrame(() => {
      raf = null;
      let target;
      try {
        target = document.querySelector(hash);
      } catch {
        // A hash that is not a valid selector — "#2024" and friends —
        // throws in querySelector. Not a reason to break navigation.
        target = null;
      }
      // ⚠️ `behavior` is deliberately NOT passed.
      //
      // Omitting it means the call inherits the root's computed
      // `scroll-behavior`, which is `smooth` normally and `auto` under
      // prefers-reduced-motion — motion.css's ROOT-ELEMENT override,
      // which exists because `html[data-motion="reduced"] *` is a
      // descendant selector and cannot reach <html> itself. Passing
      // `behavior: 'smooth'` here would animate the jump for exactly
      // the users who asked it not to, and would do so invisibly to
      // anyone not testing with reduce on.
      target?.scrollIntoView();
    });

    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
    // `key` is in the deps so clicking the SAME hash twice re-scrolls:
    // react-router mints a new key per navigation, while `hash` alone
    // would be unchanged and the effect would not re-run.
  }, [hash, key, splashReady]);

  return null;
}

export default ScrollToHash;
