// frontend/src/components/ambient/PageShell.jsx
import styles from './PageShell.module.css';

/**
 * Root wrapper for the Phase 2 main page — PF-75.
 *
 * Matches the prototype's outermost div exactly:
 *   <div style="position:relative;width:100%;overflow-x:hidden">
 *
 * This establishes the stacking context every ambient layer and the
 * splash position against. Deliberately carries NO z-index of its own —
 * setting one here would create a new stacking context on this element,
 * which would trap every position:fixed child (canvas, glow, splash) at
 * this element's own stacking level instead of the document root's,
 * silently breaking every z-index value below regardless of how correct
 * each individual value is.
 */
export default function PageShell({ children }) {
  return <div className={styles.shell}>{children}</div>;
}
