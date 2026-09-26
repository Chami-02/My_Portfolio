// frontend/src/components/admin/AdminLayout.jsx
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { authService } from '../../services/authService';
import { ThemeToggle } from '../layout/ThemeToggle';
import { useMe } from '../../hooks/useMe';
import { useDashboardStats } from '../../hooks/useDashboardStats';
import { useAdminFlash } from '../../hooks/useAdminFlash';
import { AdminFooter } from './AdminFooter';
import { SessionExpiryBanner } from './SessionExpiryBanner';
import { StarfieldCanvas, CursorGlow, GrainOverlay } from '../ambient';
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
 *   - The background is the SITE's ambient layer — StarfieldCanvas,
 *     CursorGlow and GrainOverlay, exactly what HomePage mounts — and
 *     NOT the denser node-lattice canvas the design brief gives admin
 *     (DESIGN.md 6.2). PF-107 deferred the lattice; PF-109 (owner
 *     decision 2026-09-16) REJECTED it: the main page, the admin panel
 *     and the login page share one background with the same attributes
 *     and animations. The three are mounted as siblings of `.shell`,
 *     not inside it — the shell's fadeIn animates opacity, which makes
 *     it a stacking context for its duration and would trap the fixed
 *     canvases at its level instead of the document root's.
 *
 * ⚠️ The ICONS are the prototype's `⊞ ◈ { } ◐ ✎ ✉`. Two of the six were
 * colour emoji (`👤` About, `📝` Blog), which render at a different
 * weight and baseline from the geometric glyphs beside them and differ
 * per operating system.
 */

/*
 * ⚠️ NOT the prototype's order — a sanctioned deviation, owner-requested
 * 2026-09-25 (PF-112). `Admin.dc.html:991+` lists Overview · Projects · Skills ·
 * About · Blog · Messages; the owner asked for About to sit second, so the order
 * runs profile-first and then outward: who you are, what you can do, what you
 * built, what you wrote, who wrote to you.
 *
 * Recorded because a fidelity pass diffing against the frozen export will read
 * this as a transcription slip and "restore" it. It is not one.
 */
const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: '⊞' },
  { id: 'about',    label: 'About',    icon: '◐' },
  { id: 'skills',   label: 'Skills',   icon: '{ }' },
  { id: 'projects', label: 'Projects', icon: '◈' },
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
   * footer's session column — ONE request, GET /api/dashboard/stats
   * (PF-110), shared with the Overview panel's stat cards through a
   * single cache entry.
   *
   * PF-107 derived these from four full list fetches (projects, skills,
   * the admin post list, messages) because nothing cheaper existed; that
   * was five requests on every /admin mount, against a 100 / 15 min
   * limiter, before any panel asked for its own data. It is now two:
   * /auth/me and this.
   *
   * ⚠️ `counts` is undefined until the response lands, and the shell
   * renders NOTHING count-shaped in that window — no badge, no
   * `0 ITEMS`, no `0 PROJECTS · 0 SKILLS`. The PF-107 version defaulted
   * each list to [] and painted zeros for the first ~100ms; rendering a
   * number that is not the number is the defect, not a placeholder.
   */
  const { data: counts } = useDashboardStats();

  // Sidebar badge per tab. '' renders nothing — Overview and About
  // have no collection to count, which is the prototype's own choice.
  const NAV_COUNTS = counts
    ? {
        overview: '',
        projects: String(counts.projects),
        skills:   String(counts.skills),
        about:    '',
        blog:     String(counts.posts),
        messages: String(counts.unread),
      }
    : {};

  // The two static labels show regardless; the four that carry a number
  // wait for it.
  const TAB_META = {
    overview: 'DASHBOARD',
    about:    'PROFILE',
    ...(counts && {
      projects: `${counts.projects} ITEMS`,
      skills:   `${counts.skills} ITEMS`,
      blog:     `${counts.published} PUBLISHED · ${counts.drafts} DRAFT`,
      messages: `${counts.unread} UNREAD · ${counts.messages} TOTAL`,
    }),
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

  const handleLogout = async () => {
    // PF-108: the server revokes the session (so the still-valid access
    // token dies with it), THEN the browser forgets. Awaited, because
    // qc.clear() below would otherwise race a request that still needs
    // the token.
    await authService.logout();
    // Drop every cached admin response with the token that fetched it.
    // Without this, signing out and back in paints the previous
    // session's data for as long as the stale entries stay fresh.
    qc.clear();
    navigate('/admin/login');
  };

  return (
    <>
      <StarfieldCanvas />
      <CursorGlow />

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

        {/* ── Sidebar ──
            Two elements on purpose: <aside> is the RAIL (surface + divider,
            stretched to the panel's full depth) and .sidebarInner is the part
            that sticks below the header. One element cannot be both — see the
            note on .sidebarInner in the module. */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarInner}>
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

            {/* ⚠️ `<span className={styles.spacer} />` was HERE and is deleted.
                It was the prototype's `flex:1` (Admin.dc.html:145), pushing the
                SESSION card to the bottom of a viewport-tall column — and this
                column is no longer viewport-tall, so it stretched nothing and
                was pure dead markup. `.spacer` itself STAYS: the header still
                uses it, and there it is load-bearing.
                See .sidebarInner in the module for why the height went. */}
            <div className={styles.sessionCard}>
              <p className={styles.sessionLabel}>SESSION</p>
              <p className={styles.sessionBody}>
                Signed in as admin. Every change here is written straight to the
                live site.
              </p>
            </div>
          </div>
        </aside>

        {/* ── Main ── */}
        <main className={styles.main}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{title}</h1>
            <span aria-hidden="true" className={styles.titleLine} />
            <span className={styles.titleMeta}>{meta}</span>
          </div>

          {/* PF-108. Renders nothing until the last five minutes of an
              idle session; sits above the flash so the two never
              compete for the same slot. Its own store, not
              useAdminFlash — that holds ONE message and belongs to
              panel saves. */}
          <SessionExpiryBanner className={styles.flashRow} />

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

      {/* Last. z-index 70 beats page content regardless of DOM order. */}
      <GrainOverlay />
    </>
  );
}
