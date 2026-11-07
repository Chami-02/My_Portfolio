import { Link } from 'react-router-dom';
import { CalendarIcon } from '../icons';
import { projectPeriod, projectByline, projectCategory, pictureAt } from '../../utils/projectMeta';
import styles from './ProjectCard.module.css';

/**
 * PF-144 — one project, as a card: the picture ON TOP, the words below
 * (owner, 2026-11-03: "user can't read the card with an image behind").
 * Used by the home section and by /projects, so the two can never drift.
 *
 *   ┌───────────────────────────┐
 *   │ [CATEGORY]     ★ FEATURED │  ← on the picture
 *   │          picture          │
 *   ├───────────────────────────┤
 *   │ 📅 FEB 2024 – PRESENT      │
 *   │ Title                     │
 *   │ Two-line summary…         │
 *   │ Role · Client             │
 *   │ VIEW PROJECT →            │
 *   └───────────────────────────┘
 *
 * ONE link per card, the title's — a "stretched link" whose ::after covers
 * the whole card, so the picture, the words and VIEW PROJECT all open the
 * page while a screen reader hears a single link named by the title (three
 * links to one place would be three stops saying the same thing). VIEW
 * PROJECT is therefore a visual cue, `aria-hidden`.
 *
 * GitHub and LIVE SITE live on the project's page, not here (owner,
 * 2026-11-03) — a link inside a stretched link cannot be clicked anyway.
 *
 * @param project  a published project from the API
 * @param big      the home section's first slot — a larger picture and the
 *                 Anton title the big card always had
 * @param state    router state for the page (/projects passes `{ from }`
 *                 so its back link returns to the same results)
 * @param as       the wrapper — the home section passes Reveal's props
 *                 through `wrapperProps`
 */
// PF-154: `titleAs` — h3 under the home section's h2; /projects passes h2, as
// its cards sit straight under the page's h1 (Lighthouse heading-order).
export function ProjectCard({ project, big = false, state, as: Wrapper = 'article', wrapperProps = {}, titleAs: Title = 'h3' }) {
  const period   = projectPeriod(project);
  const byline   = projectByline(project);
  const category = projectCategory(project);
  const src      = project.backgroundImage?.src;

  return (
    <Wrapper
      {...wrapperProps}
      className={`${styles.card} ${big ? styles.big : ''} ${wrapperProps.className ?? ''}`}
      data-projectcard=""
    >
      <div className={styles.media}>
        {src ? (
          // Decorative here: the title beside it names the project, and the
          // page's big picture carries the description.
          <img
            className={styles.picture}
            src={pictureAt(src, big ? 1200 : 800)}
            alt=""
            loading="lazy"
            decoding="async"
          />
        ) : (
          // No picture yet: a plain panel with the title's initials, so the
          // grid keeps its rhythm instead of a hole.
          <span className={styles.noPicture} aria-hidden="true">{initials(project.title)}</span>
        )}
        {category && <span className={styles.category}>{category}</span>}
        {project.featured && <span className={styles.featured}>★ FEATURED</span>}
      </div>

      <div className={styles.body}>
        {period && (
          <p className={styles.period}>
            <CalendarIcon size={13} />
            {period}
          </p>
        )}
        <Title className={styles.title}>
          <Link className={styles.link} to={`/projects/${project.slug}`} state={state}>
            {project.title}
          </Link>
        </Title>
        <p className={styles.summary}>{project.description}</p>
        {byline && <p className={styles.byline}>{byline}</p>}
        <span className={styles.cta} aria-hidden="true">VIEW PROJECT →</span>
      </div>
    </Wrapper>
  );
}

/** "ClearDrive.lk" → "C", "Smart Campus API" → "SC". */
function initials(title = '') {
  return title.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}
