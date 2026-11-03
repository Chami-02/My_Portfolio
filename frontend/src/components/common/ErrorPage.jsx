import {
  PageShell,
  StarfieldCanvas,
  CursorGlow,
  GrainOverlay,
} from '../ambient';
import { ErrorCard } from './ErrorCard';
import styles from './ErrorPage.module.css';

/**
 * PF-144 (owner, 2026-11-03: "make full size error pages all the same look
 * and feel … smaller, like an error message") — a page that IS an error
 * (the 404, "CV not available"): the site's ambient layer with the shared
 * `ErrorCard` centred in it (near the top on a phone).
 *
 * @param label, title, children, actions — see ErrorCard
 */
export function ErrorPage({ label, title, children, actions = [] }) {
  return (
    <PageShell>
      <StarfieldCanvas />
      <CursorGlow />

      <section className={styles.page}>
        <ErrorCard label={label} title={title} actions={actions} level={1}>
          {children}
        </ErrorCard>
      </section>

      <GrainOverlay />
    </PageShell>
  );
}
