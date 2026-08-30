// frontend/src/components/layout/ScrollToHash.jsx
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useIsFetching } from '@tanstack/react-query';
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
 *
 * ─────────────────────────────────────────────────────────────────────
 * ⚠️ PF-94 — IT SCROLLS UNTIL THE PAGE STOPS MOVING, NOT ONCE.
 *
 * A single scroll one frame after the route commits is measurably
 * wrong when arriving from off the home page. Measured on the
 * production build, cold arrival at a 404 → click BLOG:
 *
 *     t=95ms   #projects 1150px   #blog at 3933   ← scroll runs here
 *     t=693ms  #projects 1264px   #blog at 4048   ← content arrived
 *
 * Projects' loading placeholder is ~114px shorter than its real
 * content, so everything below it drops once the query resolves. The
 * scroll has already finished by then and nothing re-runs it, leaving
 * #blog and #contact — the two sections BELOW the API-driven grids —
 * stranded at 186px instead of 71px, permanently. Only those two are
 * affected; #about, #skills and #projects sit at or above the shift.
 *
 * Reach: PF-86 pointed five Blog-teaser links at /blog, which has no
 * route, so this was two clicks from the home page — every navbar and
 * footer link from a 404 or /blog hit it.
 *
 * THE FIX IS A QUIESCENCE POLL, NOT A TIMEOUT. A fixed delay would be
 * a guess at how long the network takes, and CLAUDE.md's own rule —
 * "a positional assertion after a fixed wait is a timer, not a
 * measurement" — applies to the code as much as to the tests. Instead
 * the loop watches the three things that actually decide whether the
 * page has stopped moving, and stops when all three hold:
 *
 *   • `useIsFetching() === 0`  — no query is still in flight. Covers
 *     the failure path too: a query that errors also stops fetching,
 *     and its error state renders in that same commit.
 *   • the target's document-absolute position is unchanged
 *   • the scroll position is unchanged (the smooth animation has
 *     finished)
 *
 * ⚠️ WHY POSITION AND NOT A ResizeObserver. The observer answers "did
 * something change SIZE", and what breaks the landing is the target
 * changing POSITION. Those differ whenever a sibling above the target
 * grows while another shrinks by the same amount — the document height
 * never changes and the observer never fires, yet the target has
 * moved. Polling the target's own absolute offset is strictly more
 * correct and needs no second mechanism.
 *
 * ⚠️ WHY IT RE-SCROLLS ON MOVEMENT AND NOT ON BEING OFF-TARGET. During
 * a smooth scroll the target is off-target on every intermediate
 * frame. Re-issuing `scrollIntoView()` each of those frames restarts
 * the animation from wherever it had reached, and it converges slowly
 * or not at all. Re-scrolling only when the target has genuinely MOVED
 * under us leaves the browser's own animation alone, so a page that
 * never shifts is scrolled exactly once — no double-scroll when the
 * API is instant or already cached.
 *
 * Reduced motion is unaffected: `behavior` is still never passed, so
 * every one of these calls inherits the root's `scroll-behavior`,
 * which motion.css flips to `auto`. The jump stays instant, and an
 * instant scroll reaches quiescence in a frame or two.
 * ─────────────────────────────────────────────────────────────────────
 */
export function ScrollToHash() {
  const { hash, key } = useLocation();
  const splashReady = useSplashReady();
  const isFetching = useIsFetching();

  /**
   * ⚠️ PF-88. The last navigation this component has FINISHED with.
   *
   * `splashReady` is a dependency, so the effect re-runs every time the
   * gate opens. PF-88's REPLAY INTRO button did exactly that mid-session,
   * and without this a user sitting at `/#projects` who clicked replay
   * got the scroll-to-top, then the whole splash, and then a silent yank
   * back down. The button is gone, but `setReady` is still exposed via
   * `useSplashControls()`, so the hazard returns the moment anything
   * closes the gate again.
   *
   * Keyed on react-router's per-navigation `key`, not on `hash`, so
   * clicking the SAME hash twice still re-scrolls — that behaviour is
   * why `key` is in the deps at all.
   *
   * ⚠️ Set only once the page has come to rest (or the user has taken
   * over), never at effect entry. StrictMode's simulated remount runs
   * cleanup immediately after mount and cancels the pending frame;
   * marking early would record a scroll that never happened and leave
   * the second mount refusing to do it.
   */
  const settledForKey = useRef(null);

  /**
   * ⚠️ The poll's baseline SURVIVES an effect restart, and it has to.
   *
   * `isFetching` is a dependency, so the effect tears down and re-runs
   * every time a query starts or finishes — four sections means several
   * restarts per navigation. Holding the last measured position in a
   * local would reset it to `null` on each one, and a null baseline
   * means "first frame", so every restart would re-issue
   * scrollIntoView() in the middle of the browser's smooth animation
   * and restart it. Keyed on the navigation so a genuinely new
   * navigation still starts clean.
   */
  const poll = useRef({ key: null, lastAbs: null, lastY: null, quiet: 0 });

  useEffect(() => {
    if (!hash) return undefined;
    if (settledForKey.current === key) return undefined;

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

    let target;
    try {
      target = document.querySelector(hash);
    } catch {
      // A hash that is not a valid selector — "#2024" and friends —
      // throws in querySelector. Not a reason to break navigation.
      target = null;
    }
    // Not settled: the target may still be mounting behind a query. The
    // effect re-runs when `isFetching` changes, and picks it up then.
    if (!target) return undefined;

    if (poll.current.key !== key) {
      poll.current = { key, lastAbs: null, lastY: null, quiet: 0 };
    }

    let raf = null;
    // ⚠️ Checked at the top of every frame as well as cancelled. A
    // cancelled frame is not guaranteed not to run — StrictMode's
    // simulated remount and a cancel issued from inside a callback both
    // race it — and a frame that runs after the user has taken over is
    // exactly the yank this component must not produce.
    let done = false;

    /** The target's offset from the top of the DOCUMENT, which is what
     *  a layout shift above it changes. */
    const absoluteTop = () =>
      Math.round(target.getBoundingClientRect().top + window.scrollY);

    const finish = () => {
      done = true;
      settledForKey.current = key;
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      removeEventListener('wheel', release);
      removeEventListener('touchstart', release);
      removeEventListener('keydown', release);
    };

    /**
     * ⚠️ The user outranks the anchor. Once someone scrolls or types,
     * a late correction would be a yank rather than a fix, so hand
     * control back permanently for this navigation.
     *
     * Listens for INPUT (wheel / touch / key), never for `scroll` —
     * the smooth scroll this component starts fires `scroll` on every
     * frame, so a scroll listener would cancel the fix it is meant to
     * protect. These three are unambiguously the user.
     */
    function release() {
      finish();
    }

    addEventListener('wheel', release, { passive: true, once: true });
    addEventListener('touchstart', release, { passive: true, once: true });
    addEventListener('keydown', release, { once: true });

    const step = () => {
      raf = requestAnimationFrame(() => {
        raf = null;
        if (done) return;

        const state = poll.current;
        const abs = absoluteTop();
        const y = Math.round(window.scrollY);

        // Re-scroll only when the target has MOVED under us — the first
        // frame of a navigation (lastAbs === null) always scrolls, a
        // shifted layout scrolls again, and a page that never moves is
        // scrolled exactly once.
        if (state.lastAbs === null || abs !== state.lastAbs) {
          target.scrollIntoView();
        }

        const stable =
          abs === state.lastAbs && y === state.lastY && isFetching === 0;
        state.quiet = stable ? state.quiet + 1 : 0;
        state.lastAbs = abs;
        state.lastY = y;

        // Two consecutive still frames with nothing in flight. Two
        // rather than one because a scroll issued on the previous frame
        // has not been applied yet when the next one is measured.
        if (state.quiet >= 2) {
          finish();
          return;
        }
        step();
      });
    };

    step();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      removeEventListener('wheel', release);
      removeEventListener('touchstart', release);
      removeEventListener('keydown', release);
    };
    // `key` is in the deps so clicking the SAME hash twice re-scrolls:
    // react-router mints a new key per navigation, while `hash` alone
    // would be unchanged and the effect would not re-run. `isFetching`
    // is in them so the loop restarts with a fresh reading each time a
    // query starts or finishes — that value is what ends the poll.
  }, [hash, key, splashReady, isFetching]);

  return null;
}

export default ScrollToHash;
