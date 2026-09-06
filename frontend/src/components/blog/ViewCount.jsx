// frontend/src/components/blog/ViewCount.jsx
//
// The per-post view counter — PF-99, owner-requested 2026-09-06.
//
// ⚠️ A SANCTIONED ADDITION WITH NO PROTOTYPE SOURCE. Neither
// `docs/design/Blog.dc.html` nor `Portfolio Revolution.dc.html` shows a
// view count anywhere, so a fidelity pass diffing against the frozen
// export will flag every call site as "not in the design". It is
// recorded in CLAUDE.md's Locked decisions for exactly that reason.
// Same footing as BrandIcons.jsx, which is also wholly a deviation.
//
// ── Why this is a module and not three local spans ──────────────────
// Three consumers, counted rather than anticipated: /blog's two card
// shapes (BlogPage), the home teaser's card and rows (BlogSection), and
// the admin list (AdminBlogPanel). `utils/blogMeta.js`'s own header sets
// the bar — one consumer is a local function, two is a module — and the
// formatting and the a11y treatment below are the parts that must not
// drift between surfaces.
import { EyeIcon } from '../icons/BrandIcons';
import styles from './ViewCount.module.css';

/**
 * `👁 1,204`, or nothing at all.
 *
 * ⚠️ RENDERS NOTHING AT ZERO — owner's decision, 2026-09-06. Stated
 * cost, accepted rather than discovered: a missing counter and a broken
 * one look identical, and card heights then differ by data. Both halves
 * are pinned by tests (`views: 12` renders, `views: 0` does not), so the
 * absence has a guard behind it rather than being indistinguishable from
 * a regression.
 *
 * The `== null` / `< 1` pair is deliberate over a bare falsy check: a
 * post fetched from an endpoint that projected `views` away arrives
 * `undefined`, and that is the same "show nothing" case as zero, but for
 * a completely different reason. Both are handled; neither throws.
 *
 * ⚠️ `style` exists alongside `className` for ONE consumer: the admin
 * panel is still the Phase 1 UI and styles every element inline, with no
 * module of its own to hang a class on. Giving it a global class name
 * instead would have meant inventing one in a stylesheet that has no
 * other admin rules in it. The three Phase 2 surfaces all pass
 * `className`.
 *
 * @param {number}  views      the post's `views` field
 * @param {string}  className  the consuming surface's own styling
 * @param {object}  style      inline overrides, for the Phase 1 admin UI
 */
export function ViewCount({ views, className, style }) {
  if (views == null || views < 1) return null;

  return (
    <span
      className={[styles.root, className].filter(Boolean).join(' ')}
      style={style}
    >
      <EyeIcon size={13} />
      {/* en-GB, pinned for the same reason utils/blogMeta.js pins its
          date locale: this figure sits in mono type beside `1 MIN READ`,
          and a locale that groups with spaces or renders Eastern Arabic
          numerals produces a width the surrounding row has no styling
          for. Four posts will not reach four digits soon — the separator
          is here so the day it does is not a layout bug. */}
      {views.toLocaleString('en-GB')}
      {/* ⚠️ VISUALLY HIDDEN, NOT ABSENT, and not `aria-label` on the span
          above either — a bare name on a non-interactive <span> is not
          reliably announced. Without this the counter reads as a naked
          number in the middle of a card link whose accessible name is
          already title + excerpt + tags + CTA: "…READ, 12". The icon
          carries the meaning for sighted readers and nothing at all for
          a screen reader, because it is aria-hidden like every other
          glyph in BrandIcons.jsx.

          ⚠️ SINGULAR AT ONE. Found in the browser, not in review: the
          first version was a bare " views" and a post read once
          announced as "1 views". Invisible on screen — the label is
          visually hidden — so nothing but listening to it, or reading
          the rendered text content as a probe did, would have caught
          it. Every post starts at exactly 1 the first time it is read,
          so this is the MOST common state, not an edge case. */}
      <span className={styles.srOnly}>{views === 1 ? ' view' : ' views'}</span>
    </span>
  );
}

export default ViewCount;
