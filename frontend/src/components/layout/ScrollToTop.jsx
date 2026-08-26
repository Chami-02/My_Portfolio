import { useState, useEffect } from 'react';
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
 */
export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

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
