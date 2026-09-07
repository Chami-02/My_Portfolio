/* frontend/src/pages/NotFoundPage.jsx
 *
 * The 404 — PF-100. The last Phase 1 layout in the visitor-facing site.
 *
 * ⚠️ THERE IS NO PROTOTYPE SOURCE FOR THIS SCREEN. `docs/design/` has no
 * 404 and never had one — zero matches for `404` or "not found" across
 * all three .dc.html files, and github.md's screen map lists ten screens,
 * none an error page. So this is composed, not transcribed: the
 * arrangement was proposed and approved by the owner on 2026-09-07, while
 * every individual VALUE below still comes verbatim from an existing
 * prototype element. Nothing here is invented; it is recomposed.
 *
 * ⚠️ THE GIANT TRANSLUCENT GHOST NUMERAL WAS CONSIDERED AND REJECTED,
 * 2026-09-07. A ghost `404` behind the headline was approved first, then
 * withdrawn the same session once it was pointed out that it reinstates
 * the treatment the owner had already removed twice — the featured card's
 * ghost `01` (locked-decisions.md, 2026-08-22: gone from the home teaser,
 * and "/blog inherits the removal"). Recorded here because the removal is
 * guarded as an ABSENCE on two other modules, and a later reader finding
 * no ghost on the 404 should know it was decided, not overlooked.
 *
 * What this page fixes: PF-91 measured three AA contrast failures here and
 * excluded them deliberately, because its own pass was Phase 2 palette work
 * and these are Phase 1 tokens. The giant numeral read 1.91 in DARK — the
 * default theme, on the page every broken link reaches.
 *
 * ⚠️ The fix is NOT to re-tune those tokens, which is how sprint-log.md
 * framed it ("Phase 1 token work"). `--text-body` has 15 admin consumers,
 * `--border-bright` drives the scrollbar and `.btn-outline`. Re-tuning any
 * of them repaints every admin surface, which is Sprint 14's bundle. The
 * fix is to stop reading Phase 1 tokens at all: `--acc`, `--strong` and
 * `--muted` are dual-theme and already AA-verified by PF-91, so all three
 * failures resolve by construction.
 */
import { Link } from 'react-router-dom';
import {
  PageShell,
  StarfieldCanvas,
  CursorGlow,
  GrainOverlay,
} from '../components/ambient';
import styles from './NotFoundPage.module.css';

export function NotFoundPage() {
  return (
    <PageShell>
      {/* Ambient first: a section that establishes its own stacking
          context sits at the same z-tier as a z-index:0 fixed canvas, and
          CSS breaks that tie by DOM order. */}
      <StarfieldCanvas />
      <CursorGlow />

      {/* ⚠️ No `Reveal`, and no ErrorBoundary.
          Reveal: BlogPostPage's precedent — a single screen with nothing
          below the fold animates once as a whole, rather than arming a
          per-element observer that fires immediately anyway.
          ErrorBoundary: the other two pages wrap content that FETCHES.
          This markup is static and has nothing to catch, so a boundary
          here would be speculative surface. Stated, not overlooked. */}
      <section className={styles.panel}>
        <p className={styles.eyebrow}>ERROR 404</p>

        <h1 className={styles.heading}>Page not found</h1>

        <p className={styles.body}>
          This page doesn&rsquo;t exist. Probably not a bug. <br /> You just
          wandered off.
        </p>

        <div className={styles.actions}>
          <Link to="/" className={styles.actionPrimary}>
            {'← BACK TO HOME'}
          </Link>
          <Link to="/blog" className={styles.actionSecondary}>
            {'FIELD NOTES →'}
          </Link>
        </div>
      </section>

      {/* Last. z-index 70 beats page content regardless of DOM order, so
          this is fidelity to HomePage's ordering rather than a
          requirement. */}
      <GrainOverlay />
    </PageShell>
  );
}
