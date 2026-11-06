// frontend/src/components/sections/ProjectsSection.jsx
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Reveal } from '../motion';
import { useProjects } from '../../hooks/useProjects';
import { ProjectCard } from '../projects/ProjectCard';
import { SiteNumbersBox } from './SiteNumbersBox';
import { SectionLoadError } from '../common/SectionLoadError';
import styles from './ProjectsSection.module.css';
import { loadFailed } from '../../utils/queryState';

/**
 * How many projects the home page shows — the big card and up to three more
 * (owner, 2026-11-03). The rest are on /projects, behind VIEW ALL PROJECTS.
 */
export const HOME_PROJECTS = 4;

/**
 * How many placeholder cards the loading state shows in row 2.
 *
 * Unlike Skills — where the five category cards are a fixed design
 * decision — the project count is data. Three matches today's four
 * projects (one takes the big slot), and it only affects a cold load,
 * since main.jsx sets a global 5-minute staleTime. It is a guess about
 * count, not about layout: the grid is `auto-fit`, so a wrong guess
 * reflows rather than breaking.
 */
const PLACEHOLDER_CARDS = 3;

/**
 * Projects — PF-85, cards rebuilt in PF-144.
 *
 * ── PF-144 (owner, 2026-11-03) ───────────────────────────────────────
 * Every card is now a ProjectCard — the picture ON TOP, the words below —
 * because text over a background picture could not be read. The big
 * first card stays; the decorative 02·03·04
 * numerals go (no room on a picture card); GitHub / LIVE SITE moved to
 * the project's own page; the home page shows HOME_PROJECTS, then
 * VIEW ALL PROJECTS → /projects. PF-150 put the public numbers box beside
 * the big card, where the terminal was.
 *
 * Wired to `useProjects()`, like Skills and unlike About. The API
 * already sorts `{ order: 1, createdAt: -1 }` (projectController.js `SORT`),
 * so display order is an admin field rather than a code constant.
 *
 * ── Which project gets the big card ──────────────────────────────────
 * The FIRST by `order`, regardless of its `featured` flag. Owner
 * decision, 2026-08-19: two projects are genuinely featured, but the
 * prototype's numeral series starts at 02 precisely because the big card
 * does not participate in it — the FEATURED badge occupies that slot
 * instead. So `featured` controls the BADGE and `order` controls the
 * SLOT, which keeps reordering an admin action rather than a code
 * change.
 *
 * ⚠️ Second half, owner decision 2026-09-16: EVERY featured project
 * carries the badge, not only the one in the big slot. Until then a
 * featured project outside the slot rendered no badge anywhere, so
 * "featured" in the admin panel looked like it did nothing for it. The
 * small card keeps its numeral (positional, the prototype's series) and
 * gains the badge beside it; the slot rule above is unchanged.
 *
 * When `projects[0].featured` is false, the big card simply has no
 * badge — never a "01".
 */
export function ProjectsSection() {
  const projectsQuery = useProjects();
  const { data: projects, isLoading, isError, error, refetch, isFetching } = projectsQuery;
  const failed = loadFailed(projectsQuery);

  // Logged from an effect, not from render. A render-phase console.error
  // fires again on every unrelated re-render — a theme toggle, a parent
  // state change — and turns one failed fetch into a console full of
  // duplicates. Keyed on the error itself so it logs once per failure.
  useEffect(() => {
    if (isError) console.error('ProjectsSection: useProjects() failed', error);
  }, [isError, error]);

  // Destructuring, not sort/filter — the API already ordered these, and
  // re-sorting here would mutate the array TanStack Query is caching.
  const [featured, ...rest] = (projects ?? []).slice(0, HOME_PROJECTS);

  // No visible failure UI, deliberately. One section failing to load
  // should not announce the whole site as broken on a portfolio page —
  // but the section, its heading and its `#projects` anchor stay,
  // because Navbar.jsx links to it and returning null here would turn
  // that link into a dead anchor with no feedback at all. Only the grids
  // go; the cause is in the console.
  const showGrids = !failed;
  const hasData   = !isLoading && !!featured;

  return (
    <section id="projects" className={styles.projects}>
      <div className={styles.inner}>
        <Reveal type="up" className={styles.eyebrow}>
          <span className={styles.eyebrowLabel}>03 / PROJECTS</span>
          <span aria-hidden="true" className={styles.eyebrowLine} />
        </Reveal>

        <Reveal as="h2" type="up" delay={60} className={styles.heading}>
          Things I&apos;ve <span className={styles.outlined}>Built</span>
        </Reveal>

        {/* PF-144 (owner, 2026-11-03): a failed load SAYS so, with TRY
            AGAIN — it used to hide the cards quietly (PF-85). */}
        {failed && <SectionLoadError what="The projects" retry={refetch} busy={isFetching} />}

        {showGrids && (
          <>
            {/* ONE Reveal around both children, matching the prototype
                (line 317) — the card and the box enter as a unit. */}
            <Reveal type="up" className={styles.featuredRow}>
              {hasData ? (
                <ProjectCard project={featured} big />
              ) : (
                // Bare div, not a Reveal: a placeholder that animates in
                // and is then replaced animates the same slot twice.
                <div className={styles.bigCardPlaceholder} aria-hidden="true" />
              )}

              <SiteNumbersBox />
            </Reveal>

            <div className={styles.grid}>
              {hasData
                ? rest.map((project, i) => (
                    // 80 + i*70 → 80/150/220, the prototype's data-delay
                    // values exactly.
                    <ProjectCard
                      key={project._id}
                      project={project}
                      as={Reveal}
                      wrapperProps={{ as: 'article', type: 'up', delay: 80 + i * 70 }}
                    />
                  ))
                : Array.from({ length: PLACEHOLDER_CARDS }, (_, i) => (
                    <div
                      key={i}
                      className={styles.cardPlaceholder}
                      aria-hidden="true"
                    />
                  ))}
            </div>

            {/* Always shown, like VIEW ALL CERTIFICATES — /projects is
                also where the search lives. */}
            <Reveal type="up" delay={120} className={styles.viewAllRow}>
              <Link className={styles.viewAll} to="/projects">VIEW ALL PROJECTS →</Link>
            </Reveal>
          </>
        )}
      </div>
    </section>
  );
}

export default ProjectsSection;
