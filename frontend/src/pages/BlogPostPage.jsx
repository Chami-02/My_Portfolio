// frontend/src/pages/BlogPostPage.jsx
//
// The Field Notes reading view — PF-99. Transcribed from
// docs/design/Blog.dc.html:70-119 (the `isOpen` branch), minus the
// removed EMAIL ME block.
//
// ⚠️ NO SplashProvider and no ScrollToHash, matching BlogPage.jsx. The
// splash is HomePage's alone; `useSplashReady()` fails open outside a
// provider, and every hash target on this site is a home-page section.
//
// ⚠️ NO `Reveal` ANYWHERE IN THIS FILE, and that is transcription rather
// than an omission. The prototype's reader carries no `data-reveal` at
// all — it animates the whole <article> once with `riseIn` and lets the
// reader scroll through static content. That matters beyond fidelity: it
// is why the tag pill below may declare its own `transition` (PF-93's
// rule binds only on Reveal-wrapped elements, and nothing here is one).
import { useEffect, useRef } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  PageShell,
  StarfieldCanvas,
  CursorGlow,
  GrainOverlay,
} from '../components/ambient';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { useBlogPost, useRecordView } from '../hooks/useBlog';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { formatDate, formatReadTime } from '../utils/blogMeta';
import styles from './BlogPostPage.module.css';

/** `1` → `01`. The prototype's own line, for both the post numeral and
 *  the per-section ones (Blog.dc.html:594). */
const pad = (n) => String(n).padStart(2, '0');

/**
 * Has this browser session already counted a read of this post?
 *
 * ⚠️ LOCAL TO THIS FILE ON PURPOSE. There is exactly one consumer, and
 * `utils/blogMeta.js`'s header states the bar this repo uses: one
 * consumer is a local function, two is a module. PF-95 nearly shipped a
 * whole `utils/blog.js` for a formatter that already existed two lines
 * away, and that is the mistake being avoided here.
 *
 * ⚠️ BOTH BRANCHES SWALLOW. `sessionStorage` throws outright in some
 * privacy modes and when a cross-origin frame is blocked — not "returns
 * null", throws — so an unguarded read would blank the entire reading
 * view over a telemetry counter. On failure the answer is "already
 * counted", which under-counts rather than counting on every render.
 */
const VIEW_KEY = (slug) => `pg-viewed-${slug}`;

function claimView(slug) {
  try {
    if (sessionStorage.getItem(VIEW_KEY(slug))) return false;
    // ⚠️ WRITTEN BEFORE the request goes out, not in its callback. React
    // 19's StrictMode mounts every effect twice in development; a flag
    // set on success would be written after both runs had already fired,
    // and the post would count two views on every dev page load. Writing
    // first makes the second run a no-op synchronously.
    sessionStorage.setItem(VIEW_KEY(slug), '1');
    return true;
  } catch {
    return false;
  }
}

export function BlogPostPage() {
  const { slug } = useParams();
  const location = useLocation();
  const reduced  = useReducedMotion();

  const { data, isLoading, isError } = useBlogPost(slug);
  // ⚠️ `mutate` destructured out rather than holding the whole mutation
  // object. TanStack Query returns a NEW object every render but a STABLE
  // `mutate`, so this is what lets the effect below declare an honest
  // dependency array instead of suppressing the lint rule.
  const { mutate: recordView } = useRecordView();

  // The endpoint returns a COMPOUND resource (PF-96 for the neighbours,
  // PF-99 for the position), never a bare post.
  const { post, prev, next, index } = data ?? {};

  // ── where ← ALL POSTS goes ───────────────────────────────────────────
  //
  // The reader's filter travels here as router STATE, set by the cards on
  // /blog (BlogPage.jsx). Owner's decision, 2026-09-06: someone who
  // filtered to three posts and read one should land back on those three,
  // ready to clear or re-filter — not on the unfiltered index, which is
  // what the prototype's `closePost()` does.
  //
  // ⚠️ Rejected: carrying the filter in this page's own URL as
  // `/blog/docker-compose?tag=Docker`. It survives a refresh, and it also
  // puts filter params the post does not use into every shared link.
  // Router state loses them on a hard refresh instead — and the fallback
  // is then plain `/blog` under the honest `← ALL POSTS` label, rather
  // than a link that lies about where it goes.
  const fromSearch = location.state?.from ?? '';
  const backTo     = fromSearch ? `/blog?${fromSearch}` : '/blog';
  const backLabel  = fromSearch ? '← BACK TO RESULTS' : '← ALL POSTS';

  // ── scroll to the top of a newly opened post ─────────────────────────
  //
  // ⚠️ NOTHING IN THIS REPO DOES THIS ALREADY — checked, not assumed.
  // React Router keeps the scroll position across a navigation, so
  // clicking the fourth card half-way down /blog would otherwise open the
  // post already scrolled half-way down. The prototype scrolls in all
  // three of its own transitions (openPost, closePost, step).
  //
  // ⚠️ The reduced-motion read is NOT optional. A JS scrollTo with an
  // EXPLICIT `behavior` ignores motion.css's override entirely — the same
  // gap ScrollToTop.jsx documents, and the reason ScrollToHash passes no
  // behavior argument at all. There is no element to scroll into view
  // here, so the option ScrollToHash uses is not available.
  //
  // Keyed on `slug`, so prev/next hops re-scroll; a re-render does not.
  const lastSlug = useRef(null);
  useEffect(() => {
    if (lastSlug.current === slug) return;
    lastSlug.current = slug;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  }, [slug, reduced]);

  // ── count the read ───────────────────────────────────────────────────
  //
  // Gated on the post having LOADED, not on mount: firing on mount would
  // PATCH a slug that may not exist, and the endpoint answers 404 for a
  // draft or a typo. `mutate`, not `mutateAsync`, and an empty onError —
  // a view is telemetry. The 30/min limiter answering 429 to someone who
  // reloaded seven times must not put an error state on a page that
  // rendered perfectly.
  //
  useEffect(() => {
    if (!post || !slug) return;
    if (!claimView(slug)) return;
    recordView(slug, { onError: () => {} });
  }, [post, slug, recordView]);

  return (
    <PageShell>
      {/* Ambient first: a section that establishes its own stacking
          context sits at the same z-tier as a z-index:0 fixed canvas, and
          CSS breaks that tie by DOM order. */}
      <StarfieldCanvas />
      <CursorGlow />

      <ErrorBoundary>
        <article className={styles.article}>
          <div className={styles.inner}>
            <Link to={backTo} className={styles.backLink}>{backLabel}</Link>

            {isLoading && (
              <div className={styles.placeholder} aria-hidden="true" />
            )}

            {/* ── the post is gone, or was never there ─────────────────
                An inline state inside the blog's own chrome rather than a
                redirect to NotFoundPage — owner's decision, 2026-09-06.
                Two reasons: the URL stays visible so a mistyped link can
                be seen and corrected, and NotFoundPage is still the Phase
                1 layout until PF-100, so a bad blog link would otherwise
                drop the reader into the old palette entirely.

                `role="status"` announces it without stealing focus, the
                same treatment BlogPage.jsx gives its filtered empty
                state. */}
            {isError && (
              <div className={styles.notFound} role="status">
                <p className={styles.notFoundHeading}>That note is not here</p>
                <p className={styles.notFoundBody}>
                  It may have been renamed, or it may not be published yet.
                </p>
                {/* ⚠️ DISTINCT COPY from the back link above it, and
                    that is a correctness fix rather than a flourish. Both
                    controls are on screen at once in this state, and the
                    first version labelled both `← ALL POSTS` — two links,
                    same accessible name, same destination. A screen
                    reader announces them identically, and Playwright's
                    strict mode caught it as a two-element resolution.

                    Always plain `/blog`, even when a filter came through:
                    the post the reader wanted is gone, so the useful
                    offer is everything, not the subset that did not
                    contain it. */}
                <Link to="/blog" className={styles.notFoundLink}>
                  {'BROWSE FIELD NOTES →'}
                </Link>
              </div>
            )}

            {post && (
              <>
                <div className={styles.meta}>
                  {/* The position comes from the API (PF-99), where it is
                      a by-product of finding the neighbours. Guarded on
                      `>= 0` rather than truthiness — the newest post is
                      index 0, which is falsy and is exactly the post most
                      likely to be read. */}
                  {index >= 0 && (
                    <>
                      <span className={styles.metaNo}>{pad(index + 1)}</span>
                      <span className={styles.metaSep}>·</span>
                    </>
                  )}
                  <span>{formatDate(post.publishedAt || post.createdAt)}</span>
                  <span className={styles.metaSep}>·</span>
                  <span>{formatReadTime(post.readingTimeMinutes)}</span>
                </div>

                <h1 className={styles.title}>{post.title}</h1>
                <p className={styles.excerpt}>{post.excerpt}</p>

                {/* The separator rule is part of this row in the export —
                    a border-bottom on the tag container, not a standalone
                    <hr>. It renders even with no tags, which is the
                    prototype's behaviour and is what keeps the header
                    block closed off from the body. */}
                <div className={styles.tagRow}>
                  {(post.tags ?? []).map((tag) => (
                    <span key={tag} className={styles.tagPill}>{tag}</span>
                  ))}
                </div>

                {(post.sections ?? []).map((section, n) => (
                  <section key={n} className={styles.section}>
                    <h2 className={styles.sectionHeading}>
                      {/* aria-hidden: "01" announced before every heading
                          is noise, and the heading text carries the
                          identity. Same call BlogSection.jsx makes for
                          its row numerals. */}
                      <span className={styles.sectionNo} aria-hidden="true">
                        {pad(n + 1)}
                      </span>
                      {section.heading}
                    </h2>

                    {(section.body ?? []).map((para, i) => (
                      <p key={i} className={styles.para}>{para}</p>
                    ))}

                    {/* ⚠️ <p> with a dot span, NOT a <ul>/<li>. That is the
                        prototype's own markup and it is kept deliberately:
                        the dot is a styled span with a glow, and a real
                        list would bring a marker, list semantics and a
                        different indent model that none of these values
                        were written for. The cost is that a screen reader
                        does not announce "list, 3 items"; the sections are
                        short prose lists, not navigation. */}
                    {(section.bullets ?? []).map((bullet, i) => (
                      <p key={i} className={styles.bullet}>
                        <span className={styles.bulletDot} aria-hidden="true" />
                        {bullet}
                      </p>
                    ))}
                  </section>
                ))}

                {/* ⚠️ THE "GOT A QUESTION ABOUT THIS BUILD? / EMAIL ME →"
                    PANEL BELONGS HERE AND IS DELIBERATELY ABSENT.
                    Blog.dc.html:103-106 — the accent-tinted container and
                    both its children. Owner-requested removal, locked
                    2026-08-22, unbuildable until this ticket because the
                    reading view did not exist.

                    ⚠️ The tail gap is now 38px, not the export's 44px:
                    `.navRow`'s margin-top: 30px collapses against the last
                    section's margin-bottom: 38px. THAT IS CORRECT. Adding
                    a margin to hold 44px would invent a value to preserve
                    a gap left by a deleted element. Contact's own email
                    route is untouched. */}

                {(prev || next) && (
                  <nav className={styles.navRow} aria-label="More posts">
                    {/* `state={location.state}` re-passes the filter, or
                        it would evaporate after one prev/next hop and the
                        back link would silently change its label mid-read.
                        Undefined when there was none, which is the same
                        thing a plain <Link> sends. */}
                    {prev && (
                      <Link
                        to={`/blog/${prev.slug}`}
                        state={location.state}
                        className={`${styles.navCard} ${styles.navPrev}`}
                      >
                        <span className={styles.navLabel}>{'← PREVIOUS'}</span>
                        <span className={styles.navTitle}>{prev.title}</span>
                      </Link>
                    )}
                    {next && (
                      <Link
                        to={`/blog/${next.slug}`}
                        state={location.state}
                        className={`${styles.navCard} ${styles.navNext}`}
                      >
                        <span className={styles.navLabel}>{'NEXT →'}</span>
                        <span className={styles.navTitle}>{next.title}</span>
                      </Link>
                    )}
                  </nav>
                )}

                {/* ── the second way out, at the end of the read ──────
                    Owner-requested 2026-09-06. Finishing a post used to
                    leave only PREVIOUS / NEXT in reach, and those move
                    sideways to other posts — getting back to the index
                    meant scrolling the whole article up to the control at
                    the top. ⚠️ No prototype source; the export has one
                    back button and it is at the top.

                    ⚠️ `backTo` and `backLabel` are the SAME derived values
                    the top control uses, deliberately not recomputed. Two
                    derivations is how the two ends of one page come to
                    disagree about where "back" is, and a filtered reader
                    would get the filtered index from one end and the bare
                    index from the other.

                    Inside the `{post && …}` guard, so it does not appear
                    while loading or on the not-found panel — neither
                    scrolls, and the panel carries its own exit. Outside
                    the `(prev || next)` guard, so a single-post blog
                    still gets it. */}
                <div className={styles.backBottomRow}>
                  <Link to={backTo} className={styles.backLinkBottom}>
                    {backLabel}
                  </Link>
                </div>
              </>
            )}
          </div>
        </article>
      </ErrorBoundary>

      {/* Last. z-index 70 beats page content regardless of DOM order, so
          this is fidelity to HomePage's ordering rather than a
          requirement. */}
      <GrainOverlay />
    </PageShell>
  );
}

export default BlogPostPage;
