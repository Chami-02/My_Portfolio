// frontend/src/components/admin/AdminLayout.jsx
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { authService } from '../../services/authService';
import { ThemeToggle } from '../layout/ThemeToggle';
import { useMe } from '../../hooks/useMe';
import { useProjects } from '../../hooks/useProjects';
import { useSkills } from '../../hooks/useSkills';
import { useBlogPostAdmin } from '../../hooks/useBlog';
import { useMessages } from '../../hooks/useMessages';
import { useAdminFlash } from '../../hooks/useAdminFlash';
import { AdminFooter } from './AdminFooter';
import logo from '../../assets/logo.png';
import styles from './AdminLayout.module.css';
import a from '../../styles/admin.module.css';

/**
 * AdminLayout — PF-107. Full replacement of the Phase 1 shell.
 * Transcribed from docs/design/Admin.dc.html:106-166, plus the footer
 * at :572-601 (see AdminFooter.jsx).
 *
 * Two sanctioned deviations from that export, both owner-decided
 * 2026-09-12:
 *
 *   - The theme toggle is the site's 44x44 sun/moon icon button, not
 *     the prototype's 30x15 pill switch with a "LIGHT MODE" caption.
 *     This upholds the 2026-08-22 locked decision that replaced that
 *     switch everywhere else; admin was the last screen that would
 *     have carried a second, different toggle.
 *   - The full-screen node-lattice canvas the design brief gives admin
 *     (DESIGN.md 6.2) is NOT built here. Deferred to its own ticket.
 *
 * ⚠️ The ICONS are the prototype's `⊞ ◈ { } ◐ ✎ ✉`. Two of the six were
 * colour emoji (`👤` About, `📝` Blog), which render at a different
 * weight and baseline from the geometric glyphs beside them and differ
 * per operating system.
 */

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: '⊞' },
  { id: 'projects', label: 'Projects', icon: '◈' },
  { id: 'skills',   label: 'Skills',   icon: '{ }' },
  { id: 'about',    label: 'About',    icon: '◐' },
  { id: 'blog',     label: 'Blog',     icon: '✎' },
  { id: 'messages', label: 'Messages', icon: '✉' },
];

export function AdminLayout({ children, activeTab, onTabChange }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { flash, dismissFlash } = useAdminFlash();

  const { data: me } = useMe();

  /*
   * The counts behind the sidebar badges, the title meta line and the
   * footer's session column.
   *
   * ⚠️ These are the SAME query keys the panels use, so TanStack serves
   * them from one cache entry and the shell adds no network requests
   * of its own — mounting the shell simply warms what the panel was
   * about to ask for. Pointing any of these at a new key would silently
   * double the request count.
   *
   * PF-110 introduces GET /api/dashboard/stats and may take these over.
   * Until it exists, deriving from data already in flight is strictly
   * cheaper than a fifth request.
   */
  const { data: projects = [] } = useProjects();
  const { data: skills   = [] } = useSkills();
  const { data: posts    = [] } = useBlogPostAdmin();
  const { data: messages = [] } = useMessages();

  const published = posts.filter((p) => p.published).length;
  const drafts    = posts.length - published;
  const unread    = messages.filter((m) => !m.read).length;

  const counts = {
    projects:  projects.length,
    skills:    skills.length,
    posts:     posts.length,
    published,
    drafts,
    unread,
    total:     messages.length,
  };

  // Sidebar badge per tab. '' renders nothing — Overview and About
  // have no collection to count, which is the prototype's own choice.
  const NAV_COUNTS = {
    overview: '',
    projects: String(counts.projects),
    skills:   String(counts.skills),
    about:    '',
    blog:     String(counts.posts),
    messages: String(counts.unread),
  };

  const TAB_META = {
    overview: 'DASHBOARD',
    projects: `${counts.projects} ITEMS`,
    skills:   `${counts.skills} ITEMS`,
    about:    'PROFILE',
    blog:     `${published} PUBLISHED · ${drafts} DRAFT`,
    messages: `${unread} UNREAD · ${counts.total} TOTAL`,
  };

  /*
   * ⚠️ This used to read
   *   NAV_ITEMS.find((i) => i.activeTab === activeTab)?.label || …
   * `activeTab` is not a property of any nav item — the model is
   * { id, label, icon } — so that clause evaluated `undefined ===
   * activeTab` for all six and was always undefined. It was dead
   * rather than wrong, because a second, correct lookup sat behind the
   * `||` and produced the right title every time. Deleted, not
   * repaired: there was never a second lookup to repair.
   */
  const title = NAV_ITEMS.find((i) => i.id === activeTab)?.label ?? 'Dashboard';
  const meta  = TAB_META[activeTab] ?? '';

  const handleLogout = () => {
    authService.logout();
    // Drop every cached admin response with the token that fetched it.
    // Without this, signing out and back in paints the previous
    // session's data for as long as the stale entries stay fresh.
    qc.clear();
    navigate('/admin/login');
  };

  return (
    <div className={styles.shell}>

      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/?nosplash=1" className={styles.brand}>
            <img src={logo} alt="Parindra Gallage" width="40" height="40" className={styles.logo} />
            <span className={styles.brandText}>
              <span className={styles.brandName}>
                PARINDRA<span className={styles.brandDot}>.</span>DEV
              </span>
              <span className={styles.brandSub}>ADMIN PANEL</span>
            </span>
          </Link>

          <span className={styles.cmsPill}>
            <span aria-hidden="true" className={styles.cmsDot} />
            CMS
          </span>

          <span className={styles.spacer} />

          {/* Absent until /auth/me answers. Rendering a placeholder
              address would be the defect this replaces. */}
          {me?.email && (
            <span className={styles.email} title={me.email}>{me.email}</span>
          )}

          <Link to="/?nosplash=1" className={styles.homeLink}>↗ HOME</Link>

          <button type="button" onClick={handleLogout} className={styles.signOut}>
            ⏻ SIGN OUT
          </button>

          <span aria-hidden="true" className={styles.divider} />

          <ThemeToggle />
        </div>
      </header>

      <div className={styles.body}>

        {/* ── Sidebar ── */}
        <aside className={styles.sidebar}>
          <p className={styles.manage}>MANAGE</p>

          <nav className={styles.nav} aria-label="Admin sections">
            {NAV_ITEMS.map(({ id, label, icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onTabChange(id)}
                  className={styles.navItem}
                  /* aria-current drives BOTH the active styling and the
                     screen-reader announcement, so the two cannot drift
                     apart the way a separate isActive class would let
                     them. The Phase 1 shell had no aria-current at all. */
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span aria-hidden="true" className={styles.navIcon}>{icon}</span>
                  {label}
                  {NAV_COUNTS[id] && (
                    <span className={styles.navCount}>{NAV_COUNTS[id]}</span>
                  )}
                </button>
              );
            })}
          </nav>

          <span className={styles.spacer} />

          <div className={styles.sessionCard}>
            <p className={styles.sessionLabel}>SESSION</p>
            <p className={styles.sessionBody}>
              Signed in as admin. Every change here is written straight to the
              live site.
            </p>
          </div>
        </aside>

        {/* ── Main ── */}
        <main className={styles.main}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{title}</h1>
            <span aria-hidden="true" className={styles.titleLine} />
            <span className={styles.titleMeta}>{meta}</span>
          </div>

          {flash && (
            /* role="status" — a save confirmation is polite news, not an
               alert, so it must not interrupt what a screen reader is
               already saying. */
            <div className={`${a.bannerOk} ${styles.flashRow}`} role="status">
              <span aria-hidden="true" className={a.bannerDot} />
              {flash}
              <button
                type="button"
                onClick={dismissFlash}
                className={styles.flashDismiss}
                aria-label="Dismiss message"
              >
                ×
              </button>
            </div>
          )}

          {children}
        </main>
      </div>

      <AdminFooter email={me?.email} counts={counts} onSignOut={handleLogout} />
    </div>
  );
}
