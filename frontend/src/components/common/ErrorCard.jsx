import { Link } from 'react-router-dom';
import styles from './ErrorPage.module.css';

/**
 * PF-144 (owner, 2026-11-03) — THE error message card: a red "!", a small
 * label, a short heading at an ordinary size, one plain sentence, and up to
 * two small actions. Every page-sized error uses it — the full-page ones
 * (404, CV) through `ErrorPage`, and the ones inside a page's own layout
 * (a project or post that is missing or not loading, a list that did not
 * load) directly — so they all look and read the same.
 *
 * @param label     small mono label above the heading (optional)
 * @param title     the heading — sentence case
 * @param level     heading level: 1 on a page of its own, 2 inside a page
 * @param role      'alert' for a failure, 'status' for "not here" (polite)
 * @param actions   [{ label, to } | { label, href, download } | { label, onClick, disabled }]
 */
export function ErrorCard({ label, title, children, actions = [], level = 2, role }) {
  const Heading = `h${level}`;
  return (
    <div className={styles.errorCard} role={role}>
      <span className={styles.mark} aria-hidden="true">!</span>
      {label && <p className={styles.label}>{label}</p>}
      <Heading className={styles.title}>{title}</Heading>
      <p className={styles.body}>{children}</p>

      {actions.length > 0 && (
        <div className={styles.actions}>
          {actions.map((a, i) => {
            const className = i === 0 ? styles.primary : styles.secondary;
            if (a.onClick) {
              return (
                <button key={a.label} type="button" className={className} onClick={a.onClick} disabled={a.disabled}>
                  {a.label}
                </button>
              );
            }
            return a.to ? (
              <Link key={a.label} to={a.to} className={className}>{a.label}</Link>
            ) : (
              <a key={a.label} href={a.href} download={a.download || undefined} className={className}>
                {a.label}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
