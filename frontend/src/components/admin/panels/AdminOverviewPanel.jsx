// frontend/src/components/admin/panels/AdminOverviewPanel.jsx
import { useDashboardStats } from '../../../hooks/useDashboardStats';
import { greetingFor } from '../../../utils/dashboard';
import styles from './AdminOverviewPanel.module.css';
import a from '../../../styles/admin.module.css';

/**
 * AdminOverviewPanel — PF-110. Full replacement of the Phase 1 panel.
 * Transcribed from docs/design/Admin.dc.html:168-196 (markup),
 * :999-1000 (the greeting), :1087-1098 (the cards and the actions).
 *
 * What the Phase 1 panel did, and why none of it survives: it fetched
 * three full collections to print three integers — and one of those was
 * the PUBLIC blog list, already filtered to published, so its
 * `posts.filter(p => p.published)` was tautological and a draft count
 * was unobtainable. It had three cards where the prototype has four
 * (no Unread Messages), a colour-emoji icon (📝) beside geometric glyphs,
 * no greeting, no quick actions, and no loading state — `data = []`
 * defaults painted 0 / 0 / 0 before any request landed.
 *
 * Now: one request, GET /api/dashboard/stats, shared with the shell's
 * badges and the footer through a single cache entry.
 *
 * ⚠️ "Parindra" is the prototype's own literal (line 173), transcribed
 * as such. It is not read from the About document.
 *
 * ⚠️ The stat values are printed, not counted up. The public About
 * section's stats use CountUp because the Portfolio prototype animates
 * them; the Admin prototype's cards do not.
 */

// Admin.dc.html:1087-1092 — icon, label, and which stat field feeds it.
const CARDS = [
  { icon: '◈',   label: 'PROJECTS',        key: 'projects'  },
  { icon: '{ }', label: 'SKILLS',          key: 'skills'    },
  { icon: '✎',   label: 'PUBLISHED POSTS', key: 'published' },
  { icon: '✉',   label: 'UNREAD MESSAGES', key: 'unread'    },
];

// Admin.dc.html:1093-1098. NEW PROJECT and NEW SKILL land on panels that
// mount with their create form already showing, so the tab is the whole
// action; NEW POST opens the blog editor, which mounts in list view, so
// it carries `compose`. AdminPage turns that into the panel's
// `initialView`.
const ACTIONS = [
  { label: '+ NEW PROJECT', tab: 'projects', compose: false },
  { label: '+ NEW POST',    tab: 'blog',     compose: true  },
  { label: '+ NEW SKILL',   tab: 'skills',   compose: false },
  { label: 'EDIT PROFILE',  tab: 'about',    compose: false },
];

export function AdminOverviewPanel({ onNavigate }) {
  const { data: stats, isError, refetch } = useDashboardStats();

  return (
    <div className={styles.stack}>

      {/* ── Welcome ── */}
      <section className={styles.welcome} aria-labelledby="overview-welcome">
        <p className={styles.eyebrow}>
          <span aria-hidden="true" className={styles.eyebrowDot} />
          ADMIN CONSOLE · {greetingFor()}
        </p>
        <h2 id="overview-welcome" className={styles.heading}>
          Welcome back, <span className={styles.headingOutline}>Parindra</span>
        </h2>
        <p className={styles.lede}>
          Everything on the public site — projects, skills, the about profile,
          writing and inbound messages — is edited from this panel.
        </p>
      </section>

      {isError && (
        /* role="alert": the numbers the whole panel exists to show are
           missing, which is worth interrupting for — unlike the save
           flash, which is role="status". */
        <div className={a.bannerError} role="alert">
          <span aria-hidden="true" className={a.bannerDot} />
          COULDN&rsquo;T LOAD THE DASHBOARD COUNTS
          <button type="button" onClick={() => refetch()} className={a.bannerAction}>
            RETRY
          </button>
        </div>
      )}

      {/* ── Stats ── */}
      <div className={styles.statGrid}>
        {CARDS.map(({ icon, label, key }) => (
          <div key={key} className={styles.statCard}>
            <p aria-hidden="true" className={styles.statIcon}>{icon}</p>
            {stats
              ? <p className={styles.statValue}>{stats[key]}</p>
              /* The value slot, not the number 0. A count that is not
                 the count is the defect the Phase 1 panel had. */
              : <div className={styles.statSkeleton} aria-hidden="true" />}
            <p className={styles.statLabel}>{label}</p>
          </div>
        ))}
      </div>

      {/* ── Quick actions ── */}
      <section className={a.panel} aria-labelledby="overview-actions">
        <h3 id="overview-actions" className={styles.actionsTitle}>JUMP BACK IN</h3>
        <div className={styles.actionsRow}>
          {ACTIONS.map(({ label, tab, compose }) => (
            /* type="button" on every one. Not inside a form today, but a
               button with no type IS a submit button, and that is exactly
               the accident behind PF-97's "Yes, Remove" saving the post. */
            <button
              key={label}
              type="button"
              onClick={() => onNavigate(tab, { compose })}
              className={styles.action}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
