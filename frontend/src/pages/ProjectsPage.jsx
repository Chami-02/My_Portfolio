import { useEffect, useRef, useState } from 'react';
import { useNavigationType, useSearchParams } from 'react-router-dom';
import {
  PageShell,
  StarfieldCanvas,
  CursorGlow,
  GrainOverlay,
} from '../components/ambient';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { Reveal } from '../components/motion';
import { ProjectCard } from '../components/projects/ProjectCard';
import { useProjects } from '../hooks/useProjects';
import { useVocabulary } from '../hooks/useVocabulary';
import { SearchIcon, CloseIcon } from '../components/icons/BrandIcons';
import styles from './ProjectsPage.module.css';
import { ErrorCard } from '../components/common/ErrorCard';
import { loadFailed } from '../utils/queryState';
import { usePageMeta } from '../hooks/usePageMeta';

/**
 * PF-144 — /projects: every published project, with a search (owner,
 * 2026-11-03: VIEW ALL → a page "with search like /blog").
 *
 * The mechanics are /blog's (BlogPage.jsx) on purpose, so the two search
 * pages behave alike — and the comments that explain them live there:
 *   • the URL is the state (`?q=`, `?category=`, `?tech=` repeated), so a
 *     search can be shared and Back undoes a chip;
 *   • typing is debounced 300 ms and REPLACES history; a chip PUSHES;
 *   • chips come from the vocabulary's `?inUse=true` (values a published
 *     project carries), never from the results, so the row never shrinks;
 *     a chip that would find nothing is disabled, a picked one never is;
 *   • the card links carry `{ from }`, so a project's page offers
 *     ← BACK TO RESULTS;
 *   • the landing scroll goes to the top on a PUSH, never on Back.
 *
 * Two chip rows, where /blog has one: CATEGORY (one at a time — a project
 * has one) and TECH (several, ANDed, like blog tags).
 */

const ALL = 'All';
const SEARCH_DEBOUNCE_MS = 300;
const PLACEHOLDER_CARDS = 3;

const same = (a, b) => a.toLowerCase() === b.toLowerCase();

export function ProjectsPage() {
  usePageMeta({
    title: 'Projects',
    description: 'Projects built by Parindra Gallage: what each one does, how it was made and where to see it.',
    path: '/projects',
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const q        = searchParams.get('q') ?? '';
  const category = searchParams.get('category') ?? '';
  const techs    = searchParams.getAll('tech');

  // Top of the page on arrival, but never on Back (BlogPage's rule).
  const navigationType = useNavigationType();
  const didLandingScroll = useRef(false);
  useEffect(() => {
    if (didLandingScroll.current) return;
    didLandingScroll.current = true;
    if (navigationType === 'POP') return;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [navigationType]);

  // ── the search box: a draft that follows the URL, debounced into it ──
  const [draft, setDraft] = useState(q);
  const [lastQ, setLastQ] = useState(q);
  const timerRef = useRef(undefined);
  const inputRef = useRef(null);
  if (q !== lastQ) {
    setLastQ(q);
    setDraft(q);
  }

  const writeQ = (value) => setSearchParams((prev) => {
    const next = new URLSearchParams(prev);
    if (value.trim()) next.set('q', value);
    else next.delete('q');
    return next;
  }, { replace: true });

  useEffect(() => {
    if (draft === q) return undefined;
    const id = setTimeout(() => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (draft.trim()) next.set('q', draft);
        else next.delete('q');
        return next;
      }, { replace: true });
    }, SEARCH_DEBOUNCE_MS);
    timerRef.current = id;
    return () => clearTimeout(id);
  }, [draft, q, setSearchParams]);

  const commitSearch = () => {
    clearTimeout(timerRef.current);
    writeQ(draft.trim());
  };

  const clearSearch = () => {
    clearTimeout(timerRef.current);
    setDraft('');
    writeQ('');
    inputRef.current?.focus();
  };

  // ── data ──────────────────────────────────────────────────────────────
  const projectsQuery = useProjects({ q, tech: techs, category });
  const { data: projects, isLoading, isError, error, refetch, isFetching } = projectsQuery;
  const failed = loadFailed(projectsQuery);
  // Unfiltered — the "2 OF 5" total and the chips' would-match check. While
  // no filter is set this IS the query above (one key, one request).
  const { data: everyProject } = useProjects();
  const { data: categoryVocab } = useVocabulary('category', { inUse: true });
  const { data: techVocab } = useVocabulary('tech', { inUse: true });

  useEffect(() => {
    if (isError) console.error('ProjectsPage: useProjects() failed', error);
  }, [isError, error]);

  const list    = projects ?? [];
  const total   = everyProject?.length ?? 0;
  const isEmpty = !isLoading && !isError && list.length === 0;

  // ── chips ─────────────────────────────────────────────────────────────
  const hasCategory = (p, c) => (p.categories ?? []).some((v) => same(v, c));
  const hasTech     = (p, t) => (p.tech ?? []).some((v) => same(v, t));
  const matches = (p, cat, techList) =>
    (!cat || hasCategory(p, cat)) && techList.every((t) => hasTech(p, t));

  const isTechSelected = (t) => techs.some((v) => same(v, t));

  /** A chip is disabled when picking it would find nothing (never a picked one). */
  const categoryDisabled = (c) =>
    !!everyProject && !same(c, category) && !everyProject.some((p) => matches(p, c, techs));
  const techDisabled = (t) =>
    !!everyProject && !isTechSelected(t) && !everyProject.some((p) => matches(p, category, [...techs, t]));

  const pickCategory = (c) => setSearchParams((prev) => {
    const next = new URLSearchParams(prev);
    if (c === ALL || same(c, category)) next.delete('category');
    else next.set('category', c);
    return next;
  });

  const pickTech = (t) => setSearchParams((prev) => {
    const next = new URLSearchParams(prev);
    next.delete('tech');
    if (t !== ALL) {
      const kept = isTechSelected(t) ? techs.filter((v) => !same(v, t)) : [...techs, t];
      kept.forEach((v) => next.append('tech', v));
    }
    return next;
  });

  const clearFilters = () => setSearchParams(new URLSearchParams());

  const hasQuery   = q.trim() !== '';
  const isFiltered = hasQuery || !!category || techs.length > 0;
  const fromState  = isFiltered ? { from: searchParams.toString() } : undefined;

  const countLabel = list.length === total
    ? `${total} ${total === 1 ? 'PROJECT' : 'PROJECTS'} · ALL`
    : `${list.length} OF ${total} PROJECTS`;

  const what = [
    hasQuery && `"${q.trim()}"`,
    category && `in ${category.toUpperCase()}`,
    techs.length && `built with ${techs.map((t) => t.toUpperCase()).join(' and ')}`,
  ].filter(Boolean).join(' ');

  const chipRow = (label, values, { active, disabled, onPick, allActive }) => (
    <div className={styles.chipGroup} role="group" aria-label={`Filter by ${label.toLowerCase()}`}>
      <span className={styles.chipGroupLabel} aria-hidden="true">{label}</span>
      {/* Wraps on a wide screen; ONE swipeable line on a phone (CSS). */}
      <div className={styles.chipList}>
      {[ALL, ...values].map((value) => {
        const on  = value === ALL ? allActive : active(value);
        const off = value !== ALL && disabled(value);
        return (
          <button
            key={value}
            type="button"
            aria-pressed={on}
            disabled={off}
            className={[styles.chip, on ? styles.chipActive : '', off ? styles.chipDisabled : '']
              .filter(Boolean).join(' ')}
            onClick={() => onPick(value)}
          >
            {value}
          </button>
        );
      })}
      </div>
    </div>
  );

  const categories = (categoryVocab ?? []).map((v) => v.value);
  const techValues = (techVocab ?? []).map((v) => v.value);

  return (
    <PageShell>
      {/* Ambient first — /blog's order, for the same stacking reason. */}
      <StarfieldCanvas />
      <CursorGlow />

      <ErrorBoundary>
        <section className={styles.header}>
          <div className={styles.inner}>
            <Reveal type="up" className={styles.eyebrow}>
              <span className={styles.eyebrowLabel}>THE WORK</span>
              <span aria-hidden="true" className={styles.eyebrowLine} />
            </Reveal>

            <Reveal as="h1" type="up" delay={60} className={styles.heading}>
              Things I&apos;ve <span className={styles.outlined}>Built</span>
            </Reveal>

            <Reveal as="p" type="up" delay={120} className={styles.deck}>
              Every project, with the story behind it — what it does, what I
              built, and what it changed.
            </Reveal>

            <Reveal type="up" delay={180} className={styles.statRow}>
              {/* No count until there is one — a failed load is not "0". */}
              {total > 0 && (
                <span className={styles.countPill}>
                  <span aria-hidden="true" className={styles.countDot} />
                  {countLabel}
                </span>
              )}
            </Reveal>

            {/* ⚠️ Every chip is type="button": they sit inside the form. */}
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
                <input
                  ref={inputRef}
                  type="text"
                  className={styles.searchInput}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Search projects, tools, roles…"
                  aria-label="Search projects, tools and roles"
                />
                {draft !== '' && (
                  <button type="button" className={styles.searchClear} onClick={clearSearch}
                    aria-label="Clear search">
                    <CloseIcon size={14} />
                  </button>
                )}
                <button type="submit" className={styles.searchSubmit} aria-label="Search">
                  <SearchIcon size={16} />
                </button>
              </label>

              {categories.length > 0 && chipRow('CATEGORY', categories, {
                active: (c) => same(c, category),
                disabled: categoryDisabled,
                onPick: pickCategory,
                allActive: !category,
              })}
              {techValues.length > 0 && chipRow('TECH', techValues, {
                active: isTechSelected,
                disabled: techDisabled,
                onPick: pickTech,
                allActive: techs.length === 0,
              })}
            </Reveal>

            {/* Outside the form: CLEAR ALL is not a search action. */}
            {isFiltered && (
              <div className={styles.activeFilters}>
                <span className={styles.activeFiltersLabel}>FILTERING BY</span>
                {hasQuery && (
                  <button type="button" className={styles.activeFilterPill} onClick={clearSearch}
                    aria-label={`Clear the search for ${q.trim()}`}>
                    <span>“{q.trim()}”</span>
                    <CloseIcon size={12} />
                  </button>
                )}
                {category && (
                  <button type="button" className={styles.activeFilterPill} onClick={() => pickCategory(ALL)}
                    aria-label={`Clear the ${category} category filter`}>
                    <span>{category.toUpperCase()}</span>
                    <CloseIcon size={12} />
                  </button>
                )}
                {techs.map((t) => (
                  <button key={t} type="button" className={styles.activeFilterPill} onClick={() => pickTech(t)}
                    aria-label={`Clear the ${t} tech filter`}>
                    <span>{t.toUpperCase()}</span>
                    <CloseIcon size={12} />
                  </button>
                ))}
                <button type="button" className={styles.clearAll} onClick={clearFilters}>
                  CLEAR ALL
                </button>
              </div>
            )}
          </div>
        </section>

        <section className={styles.results}>
          <div className={styles.inner}>
            {!failed && !isEmpty && (
              <div className={styles.grid}>
                {isLoading
                  ? Array.from({ length: PLACEHOLDER_CARDS }, (_, i) => (
                    <div key={i} className={styles.cardPlaceholder} aria-hidden="true" />
                  ))
                  : list.map((project) => (
                    <ProjectCard key={project._id} project={project} state={fromState} titleAs="h2" />
                  ))}
              </div>
            )}

            {/* PF-144: the shared error card; stays up while it retries. */}
            {failed && (
              <ErrorCard
                role="alert"
                title="The projects are not loading"
                actions={[{ label: isFetching ? 'TRYING AGAIN…' : 'TRY AGAIN', onClick: () => refetch(), disabled: isFetching }]}
              >
                They didn’t load this time. This is usually temporary — please try again.
              </ErrorCard>
            )}

            {/* Zero projects anywhere is a different fact from zero matches. */}
            {isEmpty && (total === 0 && !isFiltered ? (
              <div className={styles.empty}>
                <p className={styles.emptyHeading}>Nothing here yet</p>
                <p className={styles.emptyBodyLast}>The first project is on its way.</p>
              </div>
            ) : (
              <div className={styles.empty} role="status">
                <p className={styles.emptyHeading}>Nothing matched that</p>
                <p className={styles.emptyTerm}>No projects {what}.</p>
                <p className={styles.emptyBody}>Try another keyword or clear the filters.</p>
                <button type="button" className={styles.resetButton} onClick={clearFilters}>
                  RESET FILTERS
                </button>
              </div>
            ))}
          </div>
        </section>
      </ErrorBoundary>

      <GrainOverlay />
    </PageShell>
  );
}

export default ProjectsPage;
