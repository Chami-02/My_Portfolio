// frontend/src/components/sections/BlogSection.jsx
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Reveal } from '../motion';
import { useBlogPosts } from '../../hooks/useBlog';
import styles from './BlogSection.module.css';

/**
 * How many posts the teaser shows: one featured card plus three compact
 * rows. The prototype's own layout, and the reason the numeral series
 * stops at 04.
 */
const TEASER_COUNT = 4;

/**
 * Where every link in this section points — PF-86, Step 3.
 *
 * The prototype gives all four post links `href="#blog"`, the section's
 * own id, so clicking a post scrolls to the section you are already in.
 * That is a design-tool artefact, not a design decision: Claude Design
 * has no post-detail screen to target, which is also why the fifth link
 * points at `Blog.dc.html` — the one place it had somewhere real to go.
 *
 * Neither `/blog` nor `/blog/:slug` exists in App.jsx today, so all five
 * links point here and Sprint 13 narrows the post cards to
 * `/blog/${slug}` when the route lands. Owner's call, 2026-08-21.
 *
 * Note this is not a regression against Phase 1: its BlogSection linked
 * to `/blog/${post.slug}` with a plain `<a href>`, which has been
 * resolving to NotFoundPage for as long as the section has existed — and
 * as a full page load rather than a client-side transition.
 */
const BLOG_ROUTE = '/blog';

/**
 * Most recent first, with a deterministic tiebreak.
 *
 * ⚠️ The tiebreak is not decoration — it is load-bearing against today's
 * data. `seed.js` inserts all four posts with one `insertMany`, so
 * `timestamps: true` stamps them with an IDENTICAL `createdAt`
 * (2026-08-09T05:56:05.288Z, verified against the live API). A pure
 * date sort therefore leaves all four tied, and both Mongo's
 * `sort({ createdAt: -1 })` and `Array.prototype.sort` are free to
 * return them in any order — the live API currently hands back
 * Java/JAX-RS first, which would put it in the LATEST POST slot.
 *
 * `_id` ascending breaks the tie by insertion order, because an
 * ObjectId's trailing counter increments within a single insertMany.
 * With today's seed that reproduces the prototype's own 01·02·03·04
 * exactly — MERN, ClearDrive, Docker Compose, JAX-RS.
 *
 * It is a degenerate-case fallback and nothing more: the moment two
 * posts have different `createdAt` values the date comparison decides
 * and the `_id` branch never runs. Sorting the array is done on a COPY;
 * mutating in place would reorder the array TanStack Query is caching.
 */
function byRecency(a, b) {
  const delta = new Date(b.createdAt) - new Date(a.createdAt);
  if (delta !== 0) return delta;
  return a._id < b._id ? -1 : a._id > b._id ? 1 : 0;
}

/**
 * `JUL 2026` — the prototype's meta format.
 *
 * The locale is pinned to `en-GB` rather than the visitor's. A Sinhala
 * or Japanese locale renders a month name the design has no styling
 * for, and this label is uppercase mono at .12em tracking, which only
 * works for a three-letter Latin abbreviation.
 */
function formatMonth(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date
    .toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    .toUpperCase();
}

/**
 * `6 MIN READ` — `readingTimeMinutes` is a real schema field
 * (models/Blog.js), derived from a word count across `sections[]` by
 * the model's own pre-validate hook. Nothing is computed here.
 */
function formatReadTime(minutes) {
  return `${minutes} MIN READ`;
}

/**
 * The blog tag pill — a FOURTH pill shape, declared locally.
 *
 * It composes nothing. Against the three that already exist it is
 * closest to Skills' but scaled down on three properties (10.5px vs
 * 12px, 5px 10px vs 7px 12px, and a .06em letter-spacing neither Skills
 * nor Projects has). `patterns.module.css`'s `.pill` is a fifth shape
 * again and still has no external consumer.
 *
 * ⚠️ This pill DOES declare its own transition, and that is not a
 * violation of PF-93. The rule is about elements `Reveal` renders; the
 * pill sits INSIDE the reveal target rather than being it, so the
 * prototype's `hideReveals()` never writes to it and its declared
 * transition is what actually applies — in the export as well as here.
 */
function TagRow({ tags, className }) {
  if (!tags?.length) return null;
  return (
    <span className={className}>
      {tags.map((tag) => (
        <span key={tag} className={styles.tagPill}>{tag}</span>
      ))}
    </span>
  );
}

/**
 * Field Notes teaser — PF-86. Full replacement of the Phase 1 component,
 * transcribed from `docs/design/Portfolio Revolution.dc.html` lines
 * 414-488.
 *
 * The Field Notes PAGE is `Blog.dc.html` and is Sprint 13's. This is the
 * home page's teaser only.
 *
 * API-wired via `useBlogPosts()`, following Skills and Projects. The
 * endpoint already returns published posts sorted `createdAt: -1`
 * (blogController.js:25); they are re-sorted here anyway, on a copy, so
 * the order is a property of this component rather than of whatever the
 * server happened to send.
 */
export function BlogSection() {
  const { data: posts, isLoading, isError, error } = useBlogPosts();

  // Logged from an effect keyed on the error, not from the render body.
  // A render-phase console.error fires again on every unrelated
  // re-render — a theme toggle, a parent state change — turning one
  // failed fetch into a console full of duplicates.
  useEffect(() => {
    if (isError) console.error('BlogSection: useBlogPosts() failed', error);
  }, [isError, error]);

  const all = posts ?? [];
  const [featured, ...rows] = [...all].sort(byRecency).slice(0, TEASER_COUNT);

  // No visible failure UI, deliberately — one section failing to load
  // should not announce the whole site as broken. But the section, its
  // heading and its `#blog` anchor STAY: Navbar.jsx:12 links to `#blog`,
  // so returning null here would turn that into a dead anchor with no
  // feedback at all. Only the grid goes; the cause is in the console.
  const showGrid = !isError;
  const hasData  = !isLoading && !!featured;

  return (
    <section id="blog" className={styles.blog}>
      <div className={styles.inner}>
        <Reveal type="up" className={styles.eyebrow}>
          <span className={styles.eyebrowLabel}>04 / BLOG</span>
          <span aria-hidden="true" className={styles.eyebrowLine} />
        </Reveal>

        <div className={styles.titleRow}>
          <Reveal as="h2" type="up" delay={60} className={styles.heading}>
            Field <span className={styles.outlined}>Notes</span>
          </Reveal>

          {/* Derived, not the prototype's literal "4". The count is of
              every published post, not of the four on screen, so it
              diverges the moment a fifth is published — which is the
              point of deriving it. Rendered only when there is a real
              number to render: during a cold load or after a failed
              fetch it would read "0 POSTS", which is wrong rather than
              merely absent. The suffix is fixed copy, transcribed. */}
          {all.length > 0 && (
            <Reveal as="p" type="up" delay={120} className={styles.count}>
              {all.length} POSTS · NOTES FROM THE BUILD
            </Reveal>
          )}
        </div>

        {showGrid && (
          <div className={styles.grid}>
            {hasData ? (
              <Reveal
                as={Link}
                to={BLOG_ROUTE}
                type="up"
                delay={80}
                className={styles.featuredCard}
              >
                {/* ONE absolute layer — the sweep. The six content
                    children below each carry `position: relative` to sit
                    above it; the prototype declares that per element
                    rather than via a stacking context.

                    ⚠️ Do NOT replace that with PF-85's
                    `.card > *:not(…)` rule. That one existed to replace
                    a JS DOM walk; this is already declarative, and a
                    blanket rule would also hit this aria-hidden layer,
                    which it must not.

                    ⚠️ There were TWO layers until 2026-08-22. The ghost
                    numeral — a translucent "01" at top:-30px;right:-10px,
                    Anton clamp(120px,17vw,190px), rgba(252,163,17,.09) —
                    was removed by owner request. The ELEMENT is gone, not
                    its opacity: a zero-opacity span still occupies the
                    corner. `.sweep` is the OTHER absolute child and
                    stays; deleting it with the numeral is the same trap
                    that nearly took `.scanTexture` with the splash scan
                    lines and `.portraitFade` with the About caption. */}
                <span className={styles.sweep} aria-hidden="true" />

                <span className={styles.badge}>LATEST POST</span>

                <span className={styles.featuredMeta}>
                  <span>{formatMonth(featured.createdAt)}</span>
                  <span className={styles.featuredSep}>·</span>
                  <span>{formatReadTime(featured.readingTimeMinutes)}</span>
                </span>

                <h3 className={styles.featuredTitle}>{featured.title}</h3>
                <p className={styles.featuredExcerpt}>{featured.excerpt}</p>

                <TagRow tags={featured.tags} className={styles.featuredTagRow} />

                <span className={styles.featuredCta}>READ THE POST →</span>
              </Reveal>
            ) : (
              // Bare div, not a Reveal: a placeholder that animates in
              // and is then replaced animates the same grid slot twice.
              <div className={styles.featuredPlaceholder} aria-hidden="true" />
            )}

            <div className={styles.column}>
              {hasData
                ? rows.map((post, i) => (
                    // 150 + i*70 → 150/220/290, the prototype's
                    // data-delay values exactly, continuing at 360 if a
                    // row is ever added rather than hardcoding three.
                    <Reveal
                      key={post._id}
                      as={Link}
                      to={BLOG_ROUTE}
                      type="up"
                      delay={150 + i * 70}
                      className={styles.row}
                    >
                      {/* Decorative counters — the row's title carries
                          the identity. Left audible they announce "02"
                          before every heading, and at rgba(252,163,17,.3)
                          they are not reliably visible either. */}
                      <span className={styles.rowNumeral} aria-hidden="true">
                        {String(i + 2).padStart(2, '0')}
                      </span>

                      <span className={styles.rowBody}>
                        <span className={styles.rowMeta}>
                          <span>{formatMonth(post.createdAt)}</span>
                          <span className={styles.rowSep}>·</span>
                          <span>{formatReadTime(post.readingTimeMinutes)}</span>
                        </span>
                        <span className={styles.rowTitle}>{post.title}</span>
                        <span className={styles.rowExcerpt}>{post.excerpt}</span>
                        <TagRow tags={post.tags} className={styles.rowTagRow} />
                      </span>

                      <span className={styles.rowChevron} aria-hidden="true">→</span>
                    </Reveal>
                  ))
                : Array.from({ length: TEASER_COUNT - 1 }, (_, i) => (
                    <div
                      key={i}
                      className={styles.rowPlaceholder}
                      aria-hidden="true"
                    />
                  ))}

              {/* Fourth child of the right column, inside its gap: 12px
                  grid — NOT a sibling of the outer grid. Renders even
                  while loading: it is a fixed link with no dependency on
                  the query, so gating it would blank it for nothing. */}
              <Reveal
                as={Link}
                to={BLOG_ROUTE}
                type="up"
                delay={360}
                className={styles.browseAll}
              >
                <span className={styles.browseLabel}>BROWSE ALL WRITING</span>
                <span className={styles.browseChevron} aria-hidden="true">→</span>
              </Reveal>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default BlogSection;
