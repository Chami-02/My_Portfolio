import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  PageShell,
  StarfieldCanvas,
  CursorGlow,
  GrainOverlay,
} from '../components/ambient';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { LoadingScreen } from '../components/common/LoadingScreen';
import { CalendarIcon, GitHubIcon } from '../components/icons';
import { ImageViewer } from '../components/projects/ImageViewer';
import { ErrorCard } from '../components/common/ErrorCard';
import { useProject } from '../hooks/useProjects';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { projectPeriod, projectCategory, pictureAt } from '../utils/projectMeta';
import styles from './ProjectPage.module.css';

const pad = (n) => String(n).padStart(2, '0');

/**
 * PF-144 — /projects/:slug, one project's own page (owner, 2026-11-03).
 *
 * The blog's reading view (BlogPostPage.jsx) with a project's header, so a
 * post and a project read alike — its comments explain the shared choices:
 * the two back links (← BACK TO RESULTS when /projects sent `{ from }`),
 * the inline not-found that keeps the URL, `LoadingScreen inline` after
 * 300 ms (PF-130), numbered sections, bullets as styled lines, and
 * prev/next carrying the router state so the back link survives a hop.
 *
 *   ← ALL PROJECTS
 *   WEB APP · 📅 FEB 2024 – PRESENT
 *   Title
 *   Summary
 *   ROLE Team lead · CLIENT ClearDrive.lk
 *   [VIEW ON GITHUB →] [● LIVE SITE ↗]
 *   ┌ big picture ┐
 *   01 Description …  02 Key Features …  03 Outcome & Impact …
 *   NN Tech Stack — pills
 *   ← PREVIOUS / NEXT →
 *
 * No view counter: projects have none (blog only).
 *
 * PF-144 part 2: a section may show up to 4 pictures under its heading
 * (1 full width, 2–4 in two columns); a click opens ImageViewer.
 */
export function ProjectPage() {
  const { slug } = useParams();
  const location = useLocation();
  const reduced  = useReducedMotion();

  const { data, isLoading, isError, error, refetch, isFetching } = useProject(slug);
  // Only a 404 means "not here". A 429, a dead server or no network means
  // "not loading" — telling a visitor a real project does not exist because
  // the server was busy would be wrong (found in the PF-144 phone pass).
  const notFound = isError && error?.response?.status === 404;
  // PF-144 part 2 — the open big view: which section, which picture.
  const [viewing, setViewing] = useState(null);
  const { project, prev, next } = data ?? {};

  const fromSearch = location.state?.from ?? '';
  const backTo     = fromSearch ? `/projects?${fromSearch}` : '/projects';
  const backLabel  = fromSearch ? '← BACK TO RESULTS' : '← ALL PROJECTS';

  // To the top on every new project (prev/next keep this component mounted).
  const lastSlug = useRef(null);
  useEffect(() => {
    if (lastSlug.current === slug) return;
    lastSlug.current = slug;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  }, [slug, reduced]);

  const sections = project?.sections ?? [];
  const period   = project ? projectPeriod(project) : '';
  const category = project ? projectCategory(project) : '';
  const src      = project?.backgroundImage?.src;

  return (
    <PageShell>
      <StarfieldCanvas />
      <CursorGlow />

      <ErrorBoundary>
        <article className={styles.article}>
          <div className={styles.inner}>
            <Link to={backTo} className={styles.backLink}>{backLabel}</Link>

            {isLoading && (
              <div className={styles.loading}>
                <div className={styles.placeholder} aria-hidden="true" />
                <LoadingScreen inline label="Loading project…" />
              </div>
            )}

            {/* Inline, keeping the URL — the blog's not-found rule. */}
            {/* PF-144: the shared error card (red "!", ordinary-size heading,
                small actions) — the same look as every other error. */}
            {isError && !notFound && (
              <ErrorCard
                role="alert"
                title="The project is not loading"
                actions={[{ label: isFetching ? 'TRYING AGAIN…' : 'TRY AGAIN', onClick: () => refetch(), disabled: isFetching }]}
              >
                It didn’t load this time. This is usually temporary — please try again.
              </ErrorCard>
            )}

            {/* Inline, keeping the URL — the blog's not-found rule. */}
            {notFound && (
              <ErrorCard
                role="status"
                title="That project is not here"
                actions={[{ label: 'SEE EVERY PROJECT →', to: '/projects' }]}
              >
                It may have been renamed, or it may not be published yet.
              </ErrorCard>
            )}

            {project && (
              <>
                {(category || period) && (
                  <div className={styles.meta}>
                    {category && <span className={styles.category}>{category}</span>}
                    {category && period && <span className={styles.metaSep}>·</span>}
                    {period && (
                      <span className={styles.period}>
                        <CalendarIcon size={12} />
                        {period}
                      </span>
                    )}
                  </div>
                )}

                <h1 className={styles.title}>{project.title}</h1>
                <p className={styles.excerpt}>{project.description}</p>

                {(project.role || project.client) && (
                  <dl className={styles.facts}>
                    {project.role && (
                      <div className={styles.fact}>
                        <dt className={styles.factLabel}>ROLE</dt>
                        <dd className={styles.factValue}>{project.role}</dd>
                      </div>
                    )}
                    {project.client && (
                      <div className={styles.fact}>
                        <dt className={styles.factLabel}>CLIENT</dt>
                        <dd className={styles.factValue}>{project.client}</dd>
                      </div>
                    )}
                  </dl>
                )}

                {/* The home card's two links, moved here (owner, 2026-11-03):
                    the GitHub mark and the live green dot as they were. */}
                <div className={styles.linkRow}>
                  {project.githubUrl && (
                    <a className={styles.githubLink} href={project.githubUrl} target="_blank" rel="noreferrer">
                      <GitHubIcon size={15} />
                      VIEW ON GITHUB →
                    </a>
                  )}
                  {project.liveUrl && (
                    <a className={styles.liveLink} href={project.liveUrl} target="_blank" rel="noreferrer">
                      <span aria-hidden="true" className={styles.liveDot} />
                      LIVE SITE ↗
                    </a>
                  )}
                </div>

                {src && (
                  <img
                    className={styles.picture}
                    src={pictureAt(src, 1640)}
                    alt={`${project.title} — screenshot`}
                    decoding="async"
                  />
                )}

                {sections.map((section, n) => (
                  <section key={n} className={styles.section}>
                    <h2 className={styles.sectionHeading}>
                      <span className={styles.sectionNo} aria-hidden="true">{pad(n + 1)}</span>
                      {section.heading}
                    </h2>
                    {/* PF-144 part 2 — the section's pictures, under its
                        heading. Each is a BUTTON (it opens the big view),
                        named by its caption or "<heading> — picture N". The
                        width/height attributes reserve the box before the
                        file arrives, so the text below never jumps. */}
                    {(section.images ?? []).length > 0 && (
                      <div className={section.images.length === 1 ? styles.pictures : `${styles.pictures} ${styles.picturesGrid}`}>
                        {section.images.map((img, i) => {
                          const name = img.caption || `${section.heading} — picture ${i + 1}`;
                          return (
                            <figure key={img.publicId || i} className={styles.figure}>
                              <button type="button" className={styles.pictureButton}
                                onClick={(e) => setViewing({ section: n, start: i, opener: e.currentTarget })}
                                aria-label={`Open ${name} larger`}>
                                <img className={styles.sectionPicture}
                                  src={pictureAt(img.url, section.images.length === 1 ? 1640 : 900)}
                                  alt={name} loading="lazy" decoding="async"
                                  {...(img.width && img.height && { width: img.width, height: img.height })} />
                              </button>
                              {img.caption && <figcaption className={styles.figcaption}>{img.caption}</figcaption>}
                            </figure>
                          );
                        })}
                      </div>
                    )}

                    {(section.body ?? []).map((para, i) => (
                      <p key={i} className={styles.para}>{para}</p>
                    ))}
                    {(section.bullets ?? []).map((bullet, i) => (
                      <p key={i} className={styles.bullet}>
                        <span className={styles.bulletDot} aria-hidden="true" />
                        {bullet}
                      </p>
                    ))}
                  </section>
                ))}

                {/* The page's last section, numbered on from the owner's. */}
                {(project.tech ?? []).length > 0 && (
                  <section className={styles.section}>
                    <h2 className={styles.sectionHeading}>
                      <span className={styles.sectionNo} aria-hidden="true">{pad(sections.length + 1)}</span>
                      Tech Stack
                    </h2>
                    <ul className={styles.techList}>
                      {project.tech.map((t) => (
                        <li key={t} className={styles.techPill}>{t}</li>
                      ))}
                    </ul>
                  </section>
                )}

                {(prev || next) && (
                  <nav className={styles.navRow} aria-label="More projects">
                    {prev && (
                      <Link to={`/projects/${prev.slug}`} state={location.state}
                        className={`${styles.navCard} ${styles.navPrev}`}>
                        <span className={styles.navLabel}>{'← PREVIOUS'}</span>
                        <span className={styles.navTitle}>{prev.title}</span>
                      </Link>
                    )}
                    {next && (
                      <Link to={`/projects/${next.slug}`} state={location.state}
                        className={`${styles.navCard} ${styles.navNext}`}>
                        <span className={styles.navLabel}>{'NEXT →'}</span>
                        <span className={styles.navTitle}>{next.title}</span>
                      </Link>
                    )}
                  </nav>
                )}

                <div className={styles.backBottomRow}>
                  <Link to={backTo} className={styles.backLinkBottom}>{backLabel}</Link>
                </div>
              </>
            )}
          </div>
        </article>
      </ErrorBoundary>

      {viewing && sections[viewing.section] && (
        <ImageViewer
          images={sections[viewing.section].images}
          start={viewing.start}
          heading={sections[viewing.section].heading}
          opener={viewing.opener}
          onClose={() => setViewing(null)}
        />
      )}

      <GrainOverlay />
    </PageShell>
  );
}

export default ProjectPage;
