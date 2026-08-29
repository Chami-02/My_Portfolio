// frontend/src/components/sections/ProjectsSection.jsx
import { useEffect } from 'react';
import { Reveal } from '../motion';
import { GitHubIcon } from '../icons';
import { useProjects } from '../../hooks/useProjects';
import styles from './ProjectsSection.module.css';

/** Schema default for `backgroundImage.opacity` (models/Project.js). */
const BG_DEFAULT_OPACITY = 0.75;

/**
 * Scrim opacity as a function of the background image's own opacity —
 * the prototype's formula (line 695), transcribed rather than rounded.
 *
 * ⚠️ At the schema default 0.75 this yields 0.8999999999999999, not a
 * clean 0.9 — 0.45 + 0.75 * 0.6 is not exactly representable in IEEE
 * 754. Left alone deliberately: the prototype's own
 * `String(Math.min(1, 0.45 + vis * 0.6))` writes the same string, so
 * rounding here would be a deviation from the design dressed up as
 * tidiness. The difference is ~1e-16 of an alpha channel.
 */
const scrimOpacity = (visibility) => Math.min(1, 0.45 + visibility * 0.6);

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
 * The terminal mockup, transcribed from the prototype (lines 336-353).
 *
 * ⚠️ NOT a port of `components/common/TerminalWindow.jsx`, which PF-89
 * DELETED. That Phase 1 component shared the concept and almost nothing
 * else: it TYPED its lines in over ~4.3s and dropped the caret when it
 * finished, where this is a static snapshot with a permanently blinking
 * caret. Every property governing how it felt differed too — radius 22px
 * vs 0.875rem, 8 lines vs 9, 12.5px/2 vs 0.8rem/1.8, literal hexes vs
 * Phase 1 tokens. Kept here as a note because "reuse the existing
 * terminal component" is the obvious-looking move, and it was wrong.
 *
 * Renders unconditionally, including while projects are loading: it is
 * hardcoded content with no dependency on the API, so gating it behind
 * the query would blank it out for no reason.
 */
function TerminalPanel() {
  return (
    <div className={styles.terminal} data-terminal="">
      <div className={styles.terminalChrome} aria-hidden="true">
        <span className={`${styles.trafficDot} ${styles.dotRed}`} />
        <span className={`${styles.trafficDot} ${styles.dotAmber}`} />
        <span className={`${styles.trafficDot} ${styles.dotGreen}`} />
        <span className={styles.terminalLabel}>terminal — portfolio</span>
      </div>

      {/* A picture of a terminal, not a live log — so it is one image to
          a screen reader rather than eight unlabelled lines. */}
      <div
        className={styles.terminalBody}
        role="img"
        aria-label="Terminal showing the portfolio stack starting up: MongoDB connected, Express API and React app running."
      >
        <div className={styles.lineCommand}>$ docker compose up --build</div>
        <div className={styles.lineInfo}>[+] Building frontend...</div>
        <div className={styles.lineInfo}>[+] Building backend...</div>
        <div className={styles.lineSuccess}>✓ MongoDB connected</div>
        <div className={styles.lineSuccess}>✓ Express API on :5000</div>
        <div className={styles.lineSuccess}>✓ React app on :5173</div>
        <div className={styles.lineAccent}>● VITE v8 ready in 420ms</div>
        <div className={styles.lineMuted}>
          ➜ http://localhost:5173 <span className={styles.caret}>▌</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Card background layers — ports the prototype's applyProjectBgs()
 * localStorage bridge (line 684) onto PF-52's schema field.
 *
 * ⚠️ `backgroundImage` is an OBJECT, `{ src, opacity }`, not a string.
 * Guarding on the object itself is always truthy and would emit
 * `url("[object Object]")` on every card.
 *
 * Returns null when there is no src, which is the prototype's else
 * branch — it sets both layers to opacity 0. Rendering nothing is the
 * same picture with two fewer elements. Every project's src is '' today
 * (seed.js sets it explicitly), so this is the live path.
 */
function CardLayers({ project }) {
  const src = project.backgroundImage?.src;
  if (!src) return null;

  const visibility = project.backgroundImage?.opacity ?? BG_DEFAULT_OPACITY;

  return (
    <>
      <span
        aria-hidden="true"
        className={styles.cardBg}
        style={{ backgroundImage: `url("${src}")`, opacity: visibility }}
      />
      <span
        aria-hidden="true"
        className={styles.cardScrim}
        style={{ opacity: scrimOpacity(visibility) }}
      />
    </>
  );
}

/**
 * The two action links. `noreferrer` implies `noopener`, so the
 * reverse-tabnabbing hole is closed — the prototype has both.
 *
 * ⚠️ TWO OWNER-REQUESTED ADDITIONS HERE (2026-08-29), neither in the
 * prototype, both recorded in CLAUDE.md's Locked decisions:
 *
 *   - the GitHub mark in front of VIEW ON GITHUB;
 *   - a pulsing green dot in front of LIVE SITE, so a deployed project
 *     reads as live at a glance.
 *
 * The trailing "→" and "↗" are the prototype's and STAY. The icon is an
 * addition to the label, not a replacement for its arrow — deleting
 * either character to "balance" the row would be an unrequested
 * transcription change.
 *
 * The dot is `aria-hidden`: "LIVE SITE" already says what it means, and
 * an exposed decorative span would add nothing a screen reader can use.
 * It is a <span>, not a ::before, so `dot-ok` can animate it
 * independently of the link's own hover treatment.
 */
function ProjectLinks({ project, className }) {
  return (
    <div className={className}>
      <a
        className={styles.githubLink}
        href={project.githubUrl}
        target="_blank"
        rel="noreferrer"
      >
        <GitHubIcon size={15} />
        VIEW ON GITHUB →
      </a>
      {project.liveUrl && (
        <a
          className={styles.liveLink}
          href={project.liveUrl}
          target="_blank"
          rel="noreferrer"
        >
          <span aria-hidden="true" className={styles.liveDot} />
          LIVE SITE ↗
        </a>
      )}
    </div>
  );
}

/**
 * Projects — PF-85. Full replacement of the Phase 1 component.
 *
 * Wired to `useProjects()`, like Skills and unlike About. The API
 * already sorts `{ order: 1, createdAt: -1 }` (projectController.js:8),
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
 * When `projects[0].featured` is false, that slot renders NOTHING — not
 * a "01". The prototype has no 01 anywhere, and inventing one means
 * inventing type styling with no design source (the small-card numeral
 * is Anton 44px above a 21px heading; the big card's heading is up to
 * 42px). The card is a flex column, so an absent child collapses its own
 * gap cleanly. Reachable state — one untick in the admin panel.
 */
export function ProjectsSection() {
  const { data: projects, isLoading, isError, error } = useProjects();

  // Logged from an effect, not from render. A render-phase console.error
  // fires again on every unrelated re-render — a theme toggle, a parent
  // state change — and turns one failed fetch into a console full of
  // duplicates. Keyed on the error itself so it logs once per failure.
  useEffect(() => {
    if (isError) console.error('ProjectsSection: useProjects() failed', error);
  }, [isError, error]);

  // Destructuring, not sort/filter — the API already ordered these, and
  // re-sorting here would mutate the array TanStack Query is caching.
  const [featured, ...rest] = projects ?? [];

  // No visible failure UI, deliberately. One section failing to load
  // should not announce the whole site as broken on a portfolio page —
  // but the section, its heading and its `#projects` anchor stay,
  // because Navbar.jsx links to it and returning null here would turn
  // that link into a dead anchor with no feedback at all. Only the grids
  // go; the cause is in the console.
  const showGrids = !isError;
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

        {showGrids && (
          <>
            {/* ONE Reveal around both children, matching the prototype
                (line 317) — the card and terminal enter as a unit. */}
            <Reveal type="up" className={styles.featuredRow}>
              {hasData ? (
                <div className={styles.bigCard} data-projectcard="">
                  <CardLayers project={featured} />
                  {featured.featured && (
                    <span className={styles.featuredBadge}>FEATURED</span>
                  )}
                  <h3 className={styles.bigTitle}>{featured.title}</h3>
                  <p className={styles.bigDesc}>{featured.description}</p>
                  <div className={styles.pillRow}>
                    {featured.tech.map((t) => (
                      <span key={t} className={styles.techPill}>{t}</span>
                    ))}
                  </div>
                  <ProjectLinks
                    project={featured}
                    className={styles.featuredLinkRow}
                  />
                </div>
              ) : (
                // Bare div, not a Reveal: a placeholder that animates in
                // and is then replaced animates the same slot twice.
                <div className={styles.bigCardPlaceholder} aria-hidden="true" />
              )}

              <TerminalPanel />
            </Reveal>

            <div className={styles.grid}>
              {hasData
                ? rest.map((project, i) => (
                    // 80 + i*70 → 80/150/220, the prototype's data-delay
                    // values exactly, continuing at 290 for a 5th card
                    // rather than special-casing the first three.
                    <Reveal
                      key={project._id}
                      type="up"
                      delay={80 + i * 70}
                      className={styles.card}
                      data-projectcard=""
                    >
                      <CardLayers project={project} />
                      {/* Numerals continue the series the big card
                          started, so four projects read 02·03·04 exactly
                          as the prototype does and a fifth reads 05.

                          aria-hidden because they are decorative counters
                          with no semantic content — the card's heading
                          carries the identity. Left audible they announce
                          as "02" before every project title, which is
                          noise, and they measure 1.75:1 dark / 1.19:1
                          light so they are not reliably visible either. */}
                      <p className={styles.numeral} aria-hidden="true">
                        {String(i + 2).padStart(2, '0')}
                      </p>
                      <h3 className={styles.cardTitle}>{project.title}</h3>
                      <p className={styles.cardDesc}>{project.description}</p>
                      <div className={styles.pillRow}>
                        {project.tech.map((t) => (
                          <span key={t} className={styles.techPill}>{t}</span>
                        ))}
                      </div>
                      <ProjectLinks
                        project={project}
                        className={styles.linkRow}
                      />
                    </Reveal>
                  ))
                : Array.from({ length: PLACEHOLDER_CARDS }, (_, i) => (
                    <div
                      key={i}
                      className={styles.cardPlaceholder}
                      aria-hidden="true"
                    />
                  ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export default ProjectsSection;
