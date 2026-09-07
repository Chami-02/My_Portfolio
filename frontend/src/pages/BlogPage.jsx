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
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigationType, useSearchParams } from 'react-router-dom';
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
import { formatDate, formatReadTime } from '../utils/blogMeta';
import { SearchIcon, CloseIcon } from '../components/icons/BrandIcons';
import { ViewCount } from '../components/blog/ViewCount';
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
  // ⚠️ getAll, not get — `?tag=Docker&tag=DevOps` is how a multi-tag
  // filter is expressed, and `get` would silently return only the first.
  const tags = searchParams.getAll('tag');

  // ── land at the top when ARRIVING here, but not on Back ──────────────
  //
  // ⚠️ FOUND BY WALKING THE REAL JOURNEY, not by reading the code. The
  // reading view's bottom back control (2026-09-06) is ~900px down a long
  // post, and React Router carries the scroll position across a
  // navigation. Landing on a SHORTER filtered index then clamps to its
  // bottom: measured `scrollY 912` against a `maxScroll` of 911, which put
  // the three result cards on screen and the search box, the tag chips and
  // CLEAR ALL entirely above the fold — the exact controls the owner
  // wanted reachable after a read.
  //
  // ⚠️ SKIPPED ON 'POP', which is what makes this correct rather than
  // merely convenient. Back and Forward should RESTORE where the reader
  // was in the grid; only a deliberate arrival (a link click, PUSH) should
  // reset. `useNavigationType()` is the discriminator, and it is the same
  // distinction a browser makes natively for a full page load.
  //
  // ⚠️ ONCE PER MOUNT, via the ref — NOT on every navigationType change.
  // This page writes the URL constantly: every debounced keystroke is a
  // REPLACE and every chip click is a PUSH. Without the ref, filtering
  // while scrolled down would yank the page to the top on each keystroke.
  // Filter changes do not remount BlogPage, so the ref holds across them
  // and releases only when the route is genuinely re-entered.
  //
  // 'instant', not 'smooth': this is arrival at a new page, which the web
  // does instantly, not a transition within one. It also keeps the
  // reduced-motion question from arising at all — unlike a JS scrollTo
  // with an explicit 'smooth', which ignores motion.css's override.
  const navigationType = useNavigationType();
  const didLandingScroll = useRef(false);
  useEffect(() => {
    if (didLandingScroll.current) return;
    didLandingScroll.current = true;
    if (navigationType === 'POP') return;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [navigationType]);

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
  // The pending debounce timer, so a submit or a clear can cancel it, and
  // the input itself, so clearing can hand focus back.
  const timerRef = useRef(undefined);
  const inputRef = useRef(null);
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
    timerRef.current = id;
    return () => clearTimeout(id);
  }, [draft, q, setSearchParams]);

  /**
   * Write the search term to the URL NOW, skipping the 300 ms wait.
   *
   * PF-104. The debounce above is what makes typing feel live; this is what
   * makes the magnifier and the Enter key mean something. Without cancelling
   * the pending timer the effect would fire again a moment later and write
   * the same value a second time — harmless in result, but a second history
   * entry and a second render for no reason.
   */
  const commitSearch = () => {
    clearTimeout(timerRef.current);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      // Trimmed, unlike the debounced path — a submit is a deliberate act,
      // so `docker ` should not land in the URL with its trailing space.
      if (draft.trim()) next.set('q', draft.trim());
      else next.delete('q');
      return next;
    }, { replace: true });
  };

  const clearSearch = () => {
    clearTimeout(timerRef.current);
    setDraft('');
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('q');
      return next;
    }, { replace: true });
    // Focus goes back to the field, not to the body — clearing a search is
    // almost always followed by typing another one, and a keyboard user
    // would otherwise have to tab back in from wherever the button sat.
    inputRef.current?.focus();
  };

  // ── data ─────────────────────────────────────────────────────────────
  //
  // TWO list queries, and the second one is not waste. The design's count
  // pill reads `4 POSTS · ALL TOPICS` unfiltered and `2 OF 4 POSTS` filtered
  // (Blog.dc.html:586), so it needs the UNFILTERED total — which a
  // server-filtered response cannot carry. `blogListParams` normalises both
  // calls, so while no filter is active the two produce an identical query
  // key and React Query issues exactly ONE request. A filter costs one extra
  // fetch, already cached from the unfiltered first paint in the common case.
  const { data: posts, isLoading, isError, error, refetch, isFetching } =
    useBlogPosts({ q, tag: tags });
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

  /** Case-insensitive, because a tag can arrive from a hand-typed URL. */
  const isSelected = (label) =>
    tags.some((t) => t.toLowerCase() === label.toLowerCase());

  const pickTag = (label) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);

      // ⚠️ delete-then-append, because `set` CANNOT express a repeated key.
      // `next.set('tag', x)` collapses every existing `tag` to one value,
      // which would silently turn a three-tag filter into a one-tag filter
      // on the next click — and it would look like the click "worked".
      next.delete('tag');
      if (label !== ALL_TAGS) {
        const kept = isSelected(label)
          // PF-104's toggle-off, now removing one tag from a set rather
          // than clearing the only one.
          ? tags.filter((t) => t.toLowerCase() !== label.toLowerCase())
          : [...tags, label];
        kept.forEach((t) => next.append('tag', t));
      }
      return next;
    });
  };

  const clearFilters = () => setSearchParams(new URLSearchParams());

  // ── What is filtered, said once ──────────────────────────────────────
  // Both the active-filter summary and the empty state read from these, so
  // the message can never describe a filter different from the one the
  // query actually used.
  //
  // ⚠️ Built from `q`/`tag` — the URL — and NOT from `draft`. `draft` is
  // whatever is in the box this instant, including a half-typed word that
  // has not been searched yet, so a message built from it would name a term
  // nobody searched for.
  const hasTagFilter = tags.length > 0;
  const hasQuery     = q.trim() !== '';
  const isFiltered   = hasQuery || hasTagFilter;

  // ── what every post card hands to the reading view (PF-99) ───────────
  //
  // Owner's decision, 2026-09-06: a reader who filtered to three posts and
  // opened one should get those same three back when they leave it — ready
  // to clear or re-filter — not the unfiltered index the prototype's
  // `closePost()` returns to. BlogPostPage reads this and swaps its label
  // to `← BACK TO RESULTS` accordingly.
  //
  // ⚠️ ROUTER STATE, not the post's own URL. `/blog/docker-compose?tag=Docker`
  // would survive a refresh, and would also put filter params the post does
  // not use into every link anyone shares. State loses them on a hard
  // refresh instead, and the fallback is then plain `/blog` under the
  // honest `← ALL POSTS` label.
  //
  // ⚠️ `undefined` rather than `{ from: '' }` when nothing is filtered —
  // that is what a plain <Link> sends, so an unfiltered card does not push
  // a history entry carrying an empty object.
  const filterState = isFiltered
    ? { from: searchParams.toString() }
    : undefined;

  // Joined with "and", matching the AND semantics — "or" would describe a
  // filter the server does not implement and send the reader looking for
  // posts that were never going to appear.
  const tagPhrase = tags.map((t) => t.toUpperCase()).join(' and ');

  let notFoundMessage = 'Nothing matched that.';
  if (hasQuery && hasTagFilter)  notFoundMessage = `No posts match "${q.trim()}" tagged ${tagPhrase}.`;
  else if (hasQuery)             notFoundMessage = `No posts match "${q.trim()}".`;
  else if (hasTagFilter)         notFoundMessage = `No posts tagged ${tagPhrase}.`;

  // ── ⚠️ NO DEAD ENDS (PF-105) ─────────────────────────────────────────
  // AND narrows fast: on four posts, Docker + Java carries zero. Rather
  // than letting the chip row build an empty page, a chip that would
  // produce no results in combination with the current selection is
  // disabled.
  //
  // ⚠️ Derived during render from `everyPost` — the UNFILTERED list the
  // count pill already fetches — so this costs no extra request and no new
  // endpoint. It must NOT come from `list`, which is already filtered and
  // would disable every chip the moment a filter narrowed the results.
  //
  // ⚠️ Not the same as PF-98's locked "the chip row must not SHRINK as you
  // filter". Every chip stays present and readable; only its activation
  // goes away. Removing chips is what that decision forbids.
  const postHasTag = (post, label) =>
    (post.tags ?? []).some((t) => t.toLowerCase() === label.toLowerCase());

  const wouldMatch = (label) =>
    (everyPost ?? []).some((post) =>
      [...tags, label].every((t) => postHasTag(post, t)));

  // A selected chip ALWAYS stays clickable — that is how it gets
  // deselected. And while `everyPost` is still loading there is nothing to
  // reason from, so nothing is disabled: dimming the whole row during a
  // cold load would be worse than dimming none of it.
  const isChipDisabled = (label) =>
    label !== ALL_TAGS && !isSelected(label) && !!everyPost && !wouldMatch(label);

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

            {/* ⚠️ PF-104 wrapped this row in a <form>, and that makes the
                `type="button"` on every chip below LOAD-BEARING rather than
                merely correct. PF-98 wrote them that way on principle when
                there was no form ("There is no form here today; the rule is
                absolute anyway") — without it, clicking any tag would now
                submit the search instead of filtering.

                The form exists so Enter works natively and so the magnifier
                can be a real submit button. `onSubmit` flushes the pending
                debounce rather than duplicating its logic. */}
            <Reveal
              as="form"
              type="up"
              delay={240}
              className={styles.searchRow}
              onSubmit={(e) => { e.preventDefault(); commitSearch(); }}
              role="search"
            >
              <label className={styles.searchField}>
                <span aria-hidden="true" className={styles.searchSlash}>/</span>
                {/* The prototype's label has no text — its only child is the
                    decorative `/`. An explicit `aria-label` is what gives the
                    field a name for a screen reader; without it the accessible
                    name would be the slash, or nothing. Invisible on screen,
                    so an implementation choice rather than a design change. */}
                <input
                  ref={inputRef}
                  type="text"
                  className={styles.searchInput}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Search posts, tags, tools…"
                  aria-label="Search posts, tags and tools"
                />

                {/* Only while there is something to clear — a permanently
                    visible × on an empty field is a dead control. */}
                {draft !== '' && (
                  <button
                    type="button"
                    className={styles.searchClear}
                    onClick={clearSearch}
                    aria-label="Clear search"
                  >
                    <CloseIcon size={14} />
                  </button>
                )}

                {/* ⚠️ The icon is aria-hidden and the BUTTON carries the
                    name — the inverse of every other icon call site in this
                    repo, where the glyph sits beside a text label. There is
                    no label here, so without this the button announces as
                    "button". */}
                <button
                  type="submit"
                  className={styles.searchSubmit}
                  aria-label="Search"
                >
                  <SearchIcon size={16} />
                </button>
              </label>

              {chips.map((label) => {
                // `All` is active when nothing is selected — it is the
                // absence of a filter, not a tag of its own.
                const active   = label === ALL_TAGS ? tags.length === 0 : isSelected(label);
                const disabled = isChipDisabled(label);
                return (
                  <button
                    key={label}
                    // ⚠️ ALWAYS explicit. A <button> with no type inside a
                    // <form> is a SUBMIT button — the trap that made PF-97's
                    // tag-delete confirm silently save the post, and since
                    // PF-104 this row IS inside a form, so it is now doing
                    // real work rather than holding a line.
                    type="button"
                    // The prototype signals the active chip with colour only.
                    // `aria-pressed` conveys the same state non-visually, and
                    // it is what makes a MULTI-select row legible: several
                    // chips can read as pressed at once.
                    aria-pressed={active}
                    // ⚠️ The real `disabled` attribute, not `aria-disabled`.
                    // The control is genuinely inert and announces as
                    // unavailable. Accepted cost: it leaves the tab order, so
                    // a keyboard user tabs past dead options instead of
                    // hearing them — better than focusing a control that
                    // does nothing when activated.
                    disabled={disabled}
                    className={[
                      styles.chip,
                      active   ? styles.chipActive   : '',
                      disabled ? styles.chipDisabled : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => pickTag(label)}
                  >
                    {label}
                  </button>
                );
              })}
            </Reveal>

            {/* ── The active-filter summary (PF-104) ────────────────────
                Until now `clearFilters` existed but was reachable ONLY from
                inside the empty state, so a visitor looking at results had
                no visible way to clear anything — the search text had to be
                selected and deleted by hand, and the tag needed the `All`
                chip. This is the always-available route back.

                Rendered outside the <form> deliberately: CLEAR ALL is not a
                search action, and inside the form it would need its own
                type="button" to avoid submitting. Keeping it out removes
                the question. */}
            {isFiltered && (
              <div className={styles.activeFilters}>
                <span className={styles.activeFiltersLabel}>FILTERING BY</span>

                {hasQuery && (
                  <button
                    type="button"
                    className={styles.activeFilterPill}
                    onClick={clearSearch}
                    aria-label={`Clear the search for ${q.trim()}`}
                  >
                    <span>“{q.trim()}”</span>
                    <CloseIcon size={12} />
                  </button>
                )}

                {/* ⚠️ ONE pill per selected tag, each clearing only its
                    own — `pickTag(t)` toggles that tag off and leaves the
                    rest standing. A single pill wired to `pickTag(ALL_TAGS)`
                    would look right and drop the whole selection. */}
                {tags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={styles.activeFilterPill}
                    onClick={() => pickTag(t)}
                    aria-label={`Clear the ${t} tag filter`}
                  >
                    <span>{t.toUpperCase()}</span>
                    <CloseIcon size={12} />
                  </button>
                ))}

                <button
                  type="button"
                  className={styles.clearAll}
                  onClick={clearFilters}
                >
                  CLEAR ALL
                </button>
              </div>
            )}
          </div>
        </section>

        <section className={styles.posts}>
          <div className={styles.inner}>
            {showGrid && (hasData ? (
              <Reveal
                as={Link}
                to={`/blog/${featured.slug}`}
                state={filterState}
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
                    {formatDate(featured.publishedAt || featured.createdAt)}
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
                {/* ⚠️ A ROW, not a bare CTA — PF-99. The view counter can be
                    absent (it renders nothing at zero), so the CTA is the
                    FIRST child of a space-between row: with no counter it
                    sits exactly where it always has. A layout that only
                    looks right when the counter is present is the failure
                    mode the hide-at-zero decision invites. */}
                <span className={styles.cardFooter}>
                  <span className={styles.featuredCta}>READ THE POST →</span>
                  <ViewCount views={featured.views} className={styles.cardViews} />
                </span>
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
                      state={filterState}
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
                        <span>{formatDate(post.publishedAt || post.createdAt)}</span>
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
                      <span className={styles.cardFooter}>
                        <span className={styles.cardCta}>READ →</span>
                        <ViewCount views={post.views} className={styles.cardViews} />
                      </span>
                    </Reveal>
                  ))
                  : !isEmpty && Array.from({ length: PLACEHOLDER_CARDS }, (_, i) => (
                    <div key={i} className={styles.cardPlaceholder} aria-hidden="true" />
                  ))}
              </div>
            )}

            {/* ⚠️ THE ERROR STATE. Added PF-101 — before it, a failed fetch
                rendered NOTHING AT ALL.

                The trace: `showGrid = !isError` killed both the featured
                block and the grid, and `isEmpty` excluded `isError`, so
                neither empty branch fired either. Every branch in this
                section was false at once and the page went blank under a
                still-rendered search header. The only record was a
                `console.error` the reader never sees.

                Reuses the `.empty` surface rather than inventing a second
                treatment: `Blog.dc.html` has an empty state (:196-202) and
                no error state, so there is nothing to transcribe, and the
                two panels are the same kind of "nothing to show you here".

                ⚠️ NOT folded into `isEmpty`. "No posts match" and "the API
                failed" are different sentences, and PF-104's
                `notFoundMessage` names the search term — meaningless when
                nothing was fetched at all.

                ⚠️ `role="alert"`, where the filtered-empty panel uses
                `role="status"`. That one is deliberately polite because
                live search fires it on almost every keystroke; this one is
                not keystroke-driven and is a genuine failure, so it should
                interrupt. */}
            {isError && (
              <div className={styles.empty} role="alert">
                <p className={styles.emptyHeading}>Field notes are not loading</p>
                <p className={styles.emptyBody}>
                  The posts could not be fetched. This is usually temporary.
                </p>
                <button
                  type="button"
                  className={styles.resetButton}
                  onClick={() => refetch()}
                  disabled={isFetching}
                >
                  {isFetching ? 'RETRYING…' : 'TRY AGAIN'}
                </button>
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
              <div className={styles.empty} role="status">
                <p className={styles.emptyHeading}>Nothing filed under that</p>
                {/* ⚠️ PF-104 names the term. The copy used to read "Try
                    another keyword or clear the filters" — true, but it
                    never told you WHAT had been searched, so a stale tag
                    left over from an earlier click looked like a site with
                    no posts. `role="status"` announces the change to a
                    screen reader without stealing focus.

                    Deliberately NOT a modal, despite the request for a
                    pop-up: search is live, so typing "docker" passes
                    through "d", "do", "doc"… and several of those match
                    nothing. A dialog would fire on almost every keystroke. */}
                <p className={styles.emptyTerm}>{notFoundMessage}</p>
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
