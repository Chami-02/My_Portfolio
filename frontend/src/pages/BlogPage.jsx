// frontend/src/pages/BlogPage.jsx
//
// The Field Notes index — PF-98. Transcribed from
// docs/design/Blog.dc.html:123-206 (the `isIndex` branch).
//
// ⚠️ No SplashProvider and no ScrollToHash, both deliberate. The splash is
// HomePage's alone; `useSplashReady()` fails open (`{ ready: true }` with no
// throw outside a provider), so `Reveal` and `StarfieldCanvas` arm
// immediately here — the documented, intended behaviour rather than an
// omission. And every hash target on this site is a section of the home
// page, so `ScrollToHash` would have nothing to do on this route.
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  PageShell,
  StarfieldCanvas,
  CursorGlow,
  GrainOverlay,
} from '../components/ambient';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { Reveal } from '../components/motion';
import { useBlogPosts } from '../hooks/useBlog';
import { useVocabulary } from '../hooks/useVocabulary';
import { formatMonth, formatReadTime } from '../utils/blogMeta';
import styles from './BlogPage.module.css';

/**
 * The chip that means "no tag filter".
 *
 * Prepended client-side rather than served: `buildMatch` in
 * backend/src/utils/blogQuery.js already treats `'All'` (any casing) as no
 * filter, so no server change was needed for it and none was made.
 */
const ALL_TAGS = 'All';

/** How many card placeholders the loading state shows. The prototype's own
 *  `hint-placeholder-count="3"` on the grid (Blog.dc.html:178). */
const PLACEHOLDER_CARDS = 3;

/**
 * ⚠️ Why the search box is debounced at all.
 *
 * PF-96 made `?q=` a SERVER-side filter, so every accepted keystroke is an
 * HTTP request, and the backend rate-limits at 100 req / 15 min / IP
 * (backend/src/middleware/rateLimiter.js). Typing "docker compose" undebounced
 * is fifteen requests from one visitor. Exhausting that budget does not
 * present as an error — it presents as the page rendering its empty state for
 * no reason, which is the hardest possible thing to diagnose from a report.
 *
 * The INPUT is not debounced; only the write to the URL is. Typing stays
 * instant because `draft` is local state.
 */
const SEARCH_DEBOUNCE_MS = 300;

/** The tag pills on a card. Two callers, two different pill shapes — see the
 *  near-miss table in BlogPage.module.css's header. */
function TagRow({ tags, className, pillClassName }) {
  if (!tags?.length) return null;
  return (
    <span className={className}>
      {tags.map((tag) => (
        <span key={tag} className={pillClassName}>{tag}</span>
      ))}
    </span>
  );
}

export function BlogPage() {
  // ── filter state lives in the URL ────────────────────────────────────
  //
  // ⚠️ An owner-approved DEVIATION from the prototype, which keeps `query`
  // and `tag` in component state (Blog.dc.html:330). The URL makes a filtered
  // view bookmarkable and shareable, survives a refresh, and makes the
  // browser's back button undo a filter — none of which the prototype can do,
  // because it is a single file with no router.
  const [searchParams, setSearchParams] = useSearchParams();
  const q   = searchParams.get('q')   ?? '';
  const tag = searchParams.get('tag') ?? ALL_TAGS;

  // ── the search box's own value ───────────────────────────────────────
  //
  // ⚠️ Kept in sync with the URL by a RENDER-PHASE adjustment, not an effect.
  // The URL is not only written by this input — the back button, a shared
  // link and RESET FILTERS all change it — so the field has to follow it. An
  // effect doing that would render one frame with the stale value first and
  // is banned outright here (`react-hooks/set-state-in-effect`). React's
  // documented "adjust state during render" pattern renders the right value
  // the first time; the setState bails out when the values already agree.
  const [draft, setDraft]   = useState(q);
  const [lastQ, setLastQ]   = useState(q);
  if (q !== lastQ) {
    setLastQ(q);
    setDraft(q);
  }

  // The setState lives in the TIMER CALLBACK, not the effect body — that is
  // the distinction the lint rule draws, and the reason this is allowed where
  // the sync above is not.
  useEffect(() => {
    if (draft === q) return undefined;
    const id = setTimeout(() => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (draft.trim()) next.set('q', draft);
        else next.delete('q');
        return next;
        // `replace` so a fifteen-character search leaves ONE history entry
        // rather than fifteen. Choosing a tag pushes (below), so the back
        // button steps through tag changes, which is the useful granularity.
      }, { replace: true });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [draft, q, setSearchParams]);

  // ── data ─────────────────────────────────────────────────────────────
  //
  // TWO list queries, and the second one is not waste. The design's count
  // pill reads `4 POSTS · ALL TOPICS` unfiltered and `2 OF 4 POSTS` filtered
  // (Blog.dc.html:586), so it needs the UNFILTERED total — which a
  // server-filtered response cannot carry. `blogListParams` normalises both
  // calls, so while no filter is active the two produce an identical query
  // key and React Query issues exactly ONE request. A filter costs one extra
  // fetch, already cached from the unfiltered first paint in the common case.
  const { data: posts, isLoading, isError, error } = useBlogPosts({ q, tag });
  const { data: everyPost } = useBlogPosts();

  // ⚠️ NOT derived from the fetched posts, which is what the prototype does
  // (Blog.dc.html:327). Locked decision: the chip row is the tag pool's
  // IN-USE half, so the admin panel drives it. Deriving it from this page's
  // list is also no longer possible — PF-96 filters server-side, so the list
  // is already filtered and derived chips would SHRINK as you filter.
  const { data: vocabulary } = useVocabulary('tag', { inUse: true });

  useEffect(() => {
    if (isError) console.error('BlogPage: useBlogPosts() failed', error);
  }, [isError, error]);

  const list  = posts ?? [];
  const total = everyPost?.length ?? 0;
  const chips = [ALL_TAGS, ...(vocabulary ?? []).map((item) => item.value)];

  // The server already ordered this — `$ifNull: [publishedAt, createdAt]`
  // descending, `_id` ascending — so `list[0]` IS the newest match. No client
  // sort: a second rule that drifts from the server's is the PF-96 bug.
  const [featured, ...rest] = list;

  const showGrid  = !isError;
  const hasData   = !isLoading && !!featured;
  const isEmpty   = !isLoading && !isError && list.length === 0;

  const countLabel = list.length === total
    ? `${total} POSTS · ALL TOPICS`
    : `${list.length} OF ${total} POSTS`;

  const pickTag = (label) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (label === ALL_TAGS) next.delete('tag');
      else next.set('tag', label);
      return next;
    });
  };

  const clearFilters = () => setSearchParams(new URLSearchParams());

  return (
    <PageShell>
      {/* Ambient first: a section that establishes its own stacking context
          sits at the same z-tier as a z-index:0 fixed canvas, and CSS breaks
          that tie by DOM order. */}
      <StarfieldCanvas />
      <CursorGlow />

      <ErrorBoundary>
        <section className={styles.header}>
          <div className={styles.inner}>
            <Reveal type="up" className={styles.eyebrow}>
              <span className={styles.eyebrowLabel}>THE JOURNAL</span>
              <span aria-hidden="true" className={styles.eyebrowLine} />
            </Reveal>

            <Reveal as="h1" type="up" delay={60} className={styles.heading}>
              Field <span className={styles.outlined}>Notes</span>
            </Reveal>

            <Reveal as="p" type="up" delay={120} className={styles.deck}>
              Everything I learn while building in public - architecture
              decisions, Docker footguns, API design and the small wins that
              make a sprint feel good.
            </Reveal>

            <Reveal type="up" delay={180} className={styles.statRow}>
              {/* Suppressed rather than shown as zero. During a cold load or
                  after a failed fetch this would otherwise read
                  `0 POSTS · ALL TOPICS`, which is wrong rather than absent. */}
              {total > 0 && (
                <span className={styles.countPill}>
                  <span aria-hidden="true" className={styles.countDot} />
                  {countLabel}
                </span>
              )}
              <span className={styles.locationPill}>
                WRITTEN FROM GALLE, SRI LANKA
              </span>
            </Reveal>

            <Reveal type="up" delay={240} className={styles.searchRow}>
              <label className={styles.searchField}>
                <span aria-hidden="true" className={styles.searchSlash}>/</span>
                {/* The prototype's label has no text — its only child is the
                    decorative `/`. An explicit `aria-label` is what gives the
                    field a name for a screen reader; without it the accessible
                    name would be the slash, or nothing. Invisible on screen,
                    so an implementation choice rather than a design change. */}
                <input
                  type="text"
                  className={styles.searchInput}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Search posts, tags, tools…"
                  aria-label="Search posts, tags and tools"
                />
              </label>

              {chips.map((label) => {
                const active = label === tag;
                return (
                  <button
                    key={label}
                    // ⚠️ ALWAYS explicit. A <button> with no type inside a
                    // <form> is a SUBMIT button — the trap that made PF-97's
                    // tag-delete confirm silently save the post. There is no
                    // form here today; the rule is absolute anyway.
                    type="button"
                    // The prototype signals the active chip with colour only.
                    // `aria-pressed` conveys the same state non-visually.
                    aria-pressed={active}
                    className={`${styles.chip} ${active ? styles.chipActive : ''}`}
                    onClick={() => pickTag(label)}
                  >
                    {label}
                  </button>
                );
              })}
            </Reveal>
          </div>
        </section>

        <section className={styles.posts}>
          <div className={styles.inner}>
            {showGrid && (hasData ? (
              <Reveal
                as={Link}
                to={`/blog/${featured.slug}`}
                type="up"
                className={styles.featuredCard}
              >
                {/* The prototype's ghost `01` is REMOVED here (locked
                    decision, 2026-08-22). `.sweep` is the card's OTHER
                    absolute child and stays — it is a different element and
                    was never what was objected to. */}
                <span className={styles.sweep} aria-hidden="true" />

                <span className={styles.featuredBadgeRow}>
                  <span className={styles.badge}>LATEST POST</span>
                  <span className={styles.featuredMeta}>
                    {formatMonth(featured.publishedAt || featured.createdAt)}
                    {' · '}
                    {formatReadTime(featured.readingTimeMinutes)}
                  </span>
                </span>

                <span className={styles.featuredTitle}>{featured.title}</span>
                <span className={styles.featuredExcerpt}>{featured.excerpt}</span>
                <TagRow
                  tags={featured.tags}
                  className={styles.featuredTagRow}
                  pillClassName={styles.featuredTagPill}
                />
                <span className={styles.featuredCta}>READ THE POST →</span>
              </Reveal>
            ) : (
              !isEmpty && (
                <div className={styles.featuredPlaceholder} aria-hidden="true" />
              )
            ))}

            {showGrid && (
              <div className={styles.grid}>
                {hasData
                  ? rest.map((post, i) => (
                    <Reveal
                      key={post._id}
                      as={Link}
                      to={`/blog/${post.slug}`}
                      type="up"
                      className={styles.card}
                    >
                      {/* Positional, because the schema has no `no` field —
                          the prototype authors one per post. Featured is 01,
                          so the grid starts at 02. */}
                      <span className={styles.cardNumeral} aria-hidden="true">
                        {String(i + 2).padStart(2, '0')}
                      </span>

                      <span className={styles.cardMeta}>
                        <span>{formatMonth(post.publishedAt || post.createdAt)}</span>
                        <span className={styles.cardMetaSep}>·</span>
                        <span>{formatReadTime(post.readingTimeMinutes)}</span>
                      </span>

                      <span className={styles.cardTitle}>{post.title}</span>
                      <span className={styles.cardExcerpt}>{post.excerpt}</span>
                      <TagRow
                        tags={post.tags}
                        className={styles.cardTagRow}
                        pillClassName={styles.cardTagPill}
                      />
                      <span className={styles.cardCta}>READ →</span>
                    </Reveal>
                  ))
                  : !isEmpty && Array.from({ length: PLACEHOLDER_CARDS }, (_, i) => (
                    <div key={i} className={styles.cardPlaceholder} aria-hidden="true" />
                  ))}
              </div>
            )}

            {/* TWO empty states, owner-approved 2026-09-05.
                The prototype has only the filtered one, whose copy tells you
                to clear filters — misleading on a blog with no published
                posts at all, where the visitor set no filter to clear. The
                discriminator is the UNFILTERED total, not this list's length:
                zero posts anywhere is a different fact from zero matches. */}
            {isEmpty && (total === 0 ? (
              <div className={styles.empty}>
                <p className={styles.emptyHeading}>Nothing filed yet</p>
                <p className={styles.emptyBodyLast}>
                  The first field note is still being written.
                </p>
              </div>
            ) : (
              <div className={styles.empty}>
                <p className={styles.emptyHeading}>Nothing filed under that</p>
                <p className={styles.emptyBody}>
                  Try another keyword or clear the filters.
                </p>
                <button
                  type="button"
                  className={styles.resetButton}
                  onClick={clearFilters}
                >
                  RESET FILTERS
                </button>
              </div>
            ))}
          </div>
        </section>
      </ErrorBoundary>

      {/* Last. z-index 70 beats page content regardless of DOM order, so this
          is fidelity to HomePage's ordering rather than a requirement. */}
      <GrainOverlay />
    </PageShell>
  );
}

export default BlogPage;
