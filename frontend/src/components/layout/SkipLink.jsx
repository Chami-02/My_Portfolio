// frontend/src/components/layout/SkipLink.jsx
import styles from './SkipLink.module.css';

/**
 * Skip-to-content link — PF-83. No prototype precedent whatsoever:
 * grepping `Portfolio Revolution.dc.html` for skip-to-content / skip-link
 * / skip-nav returns zero matches, so every decision here is this
 * project's own rather than a transcription.
 *
 * Mounted as the first child of App's layout wrapper, before the route
 * that renders <Navbar />, so it is the document's first focusable
 * element on every route. Targets <main id="main-content">, which
 * App.jsx owns.
 *
 * Two implementation choices worth knowing, both departures from the
 * ticket's sketch and both explained in SkipLink.module.css:
 *
 *   - `position: fixed`, not `absolute`. An absolutely-positioned skip
 *     link lives at the top of the DOCUMENT, so tabbing to it from
 *     halfway down the page scrolls the viewport back to the top just to
 *     bring it into view — the browser scrolls a focused element into
 *     view whether or not you want it to.
 *   - `:focus`, not `:focus-visible`. A skip link cannot be reached by
 *     mouse while hidden, so the two differ only in whether the
 *     `:focus-visible` heuristic happens to agree — and if it does not,
 *     the link stays off-screen while holding focus, which reads as the
 *     keyboard being broken.
 */
export function SkipLink() {
  return (
    <a href="#main-content" className={styles.skipLink}>
      Skip to content
    </a>
  );
}

export default SkipLink;
