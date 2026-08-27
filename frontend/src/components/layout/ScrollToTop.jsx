import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import styles from './ScrollToTop.module.css';

/**
 * Floating scroll-to-top control.
 *
 * Phase 1's, re-skinned onto the Phase 2 token set on 2026-08-25 at the
 * owner's request — see the module for what was wrong with the old
 * styling and why it was invisible in review.
 *
 * ⚠️ Since the same day this is the site's ONLY scroll-to-top affordance.
 * The footer's `SCROLL BACK UP ↑` link was removed as redundant with it,
 * so a change here has no fallback behind it.
 *
 * ⚠️ `behavior: 'smooth'` is passed explicitly, and that means
 * motion.css's root-element `scroll-behavior: auto` override does NOT
 * reach it — a JS scrollTo with an explicit behavior ignores the
 * computed value. Hence the reduced-motion read below. Same gap
 * ScrollToHash sidesteps by passing no behavior at all; there is no
 * equivalent option here, because there is no element to scroll into
 * view.
 *
 * ⚠️ It also HIDES while the footer's bottom bar is on screen
 * (owner decision, 2026-08-27). Two reasons, and the second is a real
 * defect rather than a preference:
 *
 *   · A scroll-to-top button shortcuts a long scroll. At the bottom of
 *     the page the footer's own navigation is right there, so this is
 *     the least useful the control will ever be.
 *   · It was COVERING the end of the copyright line at <=600px —
 *     "DESIGNED & BUILT FROM SCRATCH" rendered as "...FROM SCRA".
 *     ⚠️ Occlusion, NOT clipping: scrollWidth === clientWidth and the
 *     line sat 16px inside the viewport at every width, so no overflow
 *     check could see it. `elementFromPoint` at the text's own
 *     coordinates returned this BUTTON.
 *
 * ⚠️ IntersectionObserver on the bar, never a scroll-position
 * threshold: the bar's position moves with content length, so a
 * hardcoded offset would silently rot the moment the footer changes.
 *
 * ⚠️ It UNMOUNTS rather than going `opacity: 0`. An invisible but
 * focusable button is the skip-link failure mode in reverse — Tab would
 * land on a control nobody can see. `visibility: hidden` would also
 * work; unmounting is what this component already did for the scroll
 * threshold, so it stays one mechanism rather than two.
 *
 * ⚠️ The observer is keyed on `pathname`, and the reading is DERIVED
 * during render rather than reset in an effect. Without that, a visitor
 * sitting at the footer who clicks ADMIN in the fixed header unmounts
 * the footer while the last observation still says "in view" — and the
 * button stays hidden for the whole admin session, on the one route
 * where the footer cannot bring it back. Re-observing a fresh bar fires
 * immediately, so the only stale case is the one with no bar at all,
 * which the `path` comparison discards. Deriving also keeps this clear
 * of `react-hooks/set-state-in-effect`, which a reset would violate.
 */
export function ScrollToTop() {
  const [visible, setVisible] = useState(false);
  const { pathname } = useLocation();

  // { path, inView } together, so a reading taken on a previous route
  // can be discarded during render instead of reset in an effect.
  const [bottomBar, setBottomBar] = useState({ path: null, inView: false });

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    // Absent on /admin/*, where App.jsx renders no footer at all.
    const bar = document.querySelector('[data-footer-bottom]');
    if (!bar) return undefined;

    const io = new IntersectionObserver(([entry]) =>
      setBottomBar({ path: pathname, inView: entry.isIntersecting }));
    io.observe(bar);
    return () => io.disconnect();
  }, [pathname]);

  const overBottomBar = bottomBar.path === pathname && bottomBar.inView;

  if (!visible || overBottomBar) return null;

  return (
    <button
      type="button"
      onClick={() => {
        // Read at click time, never during render.
        const reduced =
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
      }}
      aria-label="Scroll to top"
      className={styles.button}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        className={styles.icon}
      >
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
