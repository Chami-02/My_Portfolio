// frontend/src/components/admin/__tests__/AdminLayout.test.jsx
//
// PF-107 — the first test for the admin shell. There has never been one.
//
// Scope is behaviour, not appearance: Sprint 14 is still rebuilding the
// panels under this shell, so pinning pixel values here would only
// manufacture failures for PF-110 → PF-117 to clean up. What is pinned
// is what must survive every one of them — the six sections and their
// glyphs, which one is current, that the title and meta line follow the
// active tab, that the header shows the REAL signed-in account, and
// that signing out both clears the cache and leaves.
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postcss from 'postcss';

const HERE = dirname(fileURLToPath(import.meta.url));
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ThemeProvider } from '../../../providers/ThemeProvider';
import { MotionProvider } from '../../../providers/MotionProvider';

// vi.mock over the hook modules rather than a stubbed network: the data
// layer is not what is under test, and Vite's SSR transform makes each
// export a getter-only property that vi.spyOn cannot redefine. Same
// pattern as AdminBlogPanel.test.jsx and BlogSection.test.jsx.
const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigate,
}));

const useMe             = vi.hoisted(() => vi.fn());
const useDashboardStats = vi.hoisted(() => vi.fn());
const logout            = vi.hoisted(() => vi.fn());
const refresh           = vi.hoisted(() => vi.fn());

vi.mock('../../../hooks/useMe',             () => ({ useMe }));
vi.mock('../../../hooks/useDashboardStats', () => ({ useDashboardStats }));
vi.mock('../../../services/authService', () => ({ authService: { logout, refresh } }));

const { AdminLayout } = await import('../AdminLayout');

// PF-110: the shell reads GET /api/dashboard/stats, not four lists. Every
// figure below is distinct from its neighbours where the shell could
// confuse them — posts (3) vs published (2) vs drafts (1), and unread (2)
// vs messages (3) — so a badge wired to the wrong field fails.
const STATS = {
  projects: 3, skills: 2, posts: 3, published: 2, drafts: 1, messages: 3, unread: 2,
};

function renderShell({ activeTab = 'overview', onTabChange = vi.fn() } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        {/* PF-109: the shell mounts StarfieldCanvas, which calls
            useReducedMotion — it throws outside MotionProvider, by design. */}
        <MotionProvider>
          <MemoryRouter>
            <AdminLayout activeTab={activeTab} onTabChange={onTabChange}>
              <p>panel content</p>
            </AdminLayout>
          </MemoryRouter>
        </MotionProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
  return { ...utils, client, onTabChange };
}

const nav = () => screen.getByRole('navigation', { name: 'Admin sections' });

beforeEach(() => {
  vi.clearAllMocks();
  useMe.mockReturnValue({ data: { email: 'owner@example.com', role: 'admin' } });
  useDashboardStats.mockReturnValue({ data: STATS });
});

describe('AdminLayout — navigation', () => {
  it('renders all six sections, in the prototype order', () => {
    renderShell();
    const labels = within(nav())
      .getAllByRole('button')
      .map((b) => b.textContent.replace(/[^A-Za-z]/g, ''));

    // Asserting NAMES rather than a count: a count is a proxy that
    // breaks under a name pointing at the wrong cause the moment an
    // unrelated control joins the landmark.
    expect(labels).toEqual([
      'Overview', 'Projects', 'Skills', 'About', 'Blog', 'Messages',
    ]);
  });

  it('uses the prototype glyphs, not the emoji they replaced', () => {
    renderShell();
    const text = nav().textContent;
    for (const glyph of ['⊞', '◈', '{ }', '◐', '✎', '✉']) {
      expect(text).toContain(glyph);
    }
    // The two that were colour emoji before PF-107. They render at a
    // different weight and baseline from the glyphs beside them.
    expect(text).not.toContain('👤');
    expect(text).not.toContain('📝');
  });

  it('marks exactly the active section with aria-current', () => {
    renderShell({ activeTab: 'skills' });
    const current = within(nav())
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-current') === 'page');

    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Skills');
  });

  it('reports the chosen section id to its parent', async () => {
    const user = userEvent.setup();
    const { onTabChange } = renderShell();
    await user.click(within(nav()).getByRole('button', { name: /Projects/ }));
    expect(onTabChange).toHaveBeenCalledWith('projects');
  });

  it('shows a count beside the countable sections and nothing beside the rest', () => {
    renderShell();
    const digits = (name) =>
      within(nav()).getByRole('button', { name: new RegExp(name) })
        .textContent.replace(/[^0-9]/g, '');

    expect(digits('Projects')).toBe('3');
    expect(digits('Skills')).toBe('2');
    expect(digits('Blog')).toBe('3');       // posts, drafts included
    expect(digits('Messages')).toBe('2');   // UNREAD only, not total

    // Overview and About have no collection to count — the prototype
    // renders an empty badge for both, so nothing must appear.
    expect(digits('Overview')).toBe('');
    expect(digits('About')).toBe('');
  });

  // PF-107 defaulted each list to [] and so painted `0` beside every
  // section for the first ~100ms of every visit. A number that is not the
  // number is worse than no number.
  it('shows no count anywhere while the stats are still loading', () => {
    useDashboardStats.mockReturnValue({ data: undefined, isLoading: true });
    renderShell({ activeTab: 'messages' });

    const buttons = within(nav()).getAllByRole('button');
    for (const b of buttons) expect(b.textContent).not.toMatch(/[0-9]/);

    // Meta line: the static labels still show; the numeric ones are empty.
    expect(screen.queryByText(/UNREAD|TOTAL|ITEMS|PUBLISHED|DRAFT/)).toBeNull();
    expect(screen.queryByText(/[0-9] PROJECTS/)).toBeNull();
  });

  it('keeps the static meta labels while loading', () => {
    useDashboardStats.mockReturnValue({ data: undefined, isLoading: true });
    renderShell({ activeTab: 'about' });
    expect(screen.getByText('PROFILE')).toBeInTheDocument();
  });
});

describe('AdminLayout — title and meta', () => {
  it.each([
    ['overview', 'Overview', 'DASHBOARD'],
    ['projects', 'Projects', '3 ITEMS'],
    ['skills',   'Skills',   '2 ITEMS'],
    ['about',    'About',    'PROFILE'],
    ['blog',     'Blog',     '2 PUBLISHED · 1 DRAFT'],
    ['messages', 'Messages', '2 UNREAD · 3 TOTAL'],
  ])('%s renders its own title and meta line', (tab, title, meta) => {
    renderShell({ activeTab: tab });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(title);
    expect(screen.getByText(meta)).toBeInTheDocument();
  });

  it('falls back rather than rendering an empty heading for an unknown tab', () => {
    renderShell({ activeTab: 'nope' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dashboard');
  });
});

describe('AdminLayout — identity', () => {
  it('shows the signed-in address the API reports', () => {
    renderShell();
    expect(screen.getByText('owner@example.com')).toBeInTheDocument();
  });

  it('never renders the placeholder address it replaced', () => {
    renderShell();
    // The Phase 1 header hardcoded this string, which is a lie in any
    // deployment. A regression here is invisible on a dev machine
    // seeded with exactly that account, which is why it is pinned.
    expect(screen.queryByText('admin@portfolio.dev')).not.toBeInTheDocument();
  });

  it('renders no address at all while /auth/me has not answered', () => {
    useMe.mockReturnValue({ data: undefined });
    renderShell();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });
});

describe('AdminLayout — sign out', () => {
  it('clears the token, empties the query cache and leaves for the login page', async () => {
    const user = userEvent.setup();
    const { client } = renderShell();

    // Plant a cache entry so "the cache was cleared" can actually fail.
    // Without this the assertion passes against a handler that never
    // calls clear(), because an empty cache is also empty afterwards.
    client.setQueryData(['projects'], [{ _id: 'stale' }]);
    expect(client.getQueryData(['projects'])).toBeTruthy();

    await user.click(screen.getAllByRole('button', { name: /SIGN OUT/i })[0]);

    expect(logout).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(['projects'])).toBeUndefined();
    expect(navigate).toHaveBeenCalledWith('/admin/login');
  });

  // PF-108: logout is now a server call (it revokes the session), and the
  // cache wipe and navigate must WAIT for it. A handler that fired all
  // three synchronously would pass the test above — logout is a mock that
  // resolves at once — so this one holds the server call open and checks
  // that nothing else has happened yet.
  it('waits for the server logout before clearing the cache and leaving', async () => {
    let release;
    logout.mockImplementation(() => new Promise((r) => { release = r; }));

    const user = userEvent.setup();
    const { client } = renderShell();
    client.setQueryData(['projects'], [{ _id: 'stale' }]);

    await user.click(screen.getAllByRole('button', { name: /SIGN OUT/i })[0]);

    expect(logout).toHaveBeenCalledTimes(1);
    // Server has not answered: cache intact, still on the page.
    expect(client.getQueryData(['projects'])).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();

    await act(async () => { release(); });

    expect(client.getQueryData(['projects'])).toBeUndefined();
    expect(navigate).toHaveBeenCalledWith('/admin/login');
  });

  it('offers sign out in both the header and the footer', () => {
    renderShell();
    // Ordinary top-and-bottom repetition, the prototype's own
    // structure — not the one-name-two-links defect PF-99 renamed.
    expect(screen.getAllByRole('button', { name: /SIGN OUT/i })).toHaveLength(2);
  });
});

describe('AdminLayout — footer', () => {
  it('renders the running counts in the session column', () => {
    renderShell();
    expect(
      screen.getByText('3 PROJECTS · 2 SKILLS · 2 POSTS · 2 UNREAD'),
    ).toBeInTheDocument();
  });

  it('links back to the home page with the splash suppressed', () => {
    renderShell();
    const back = screen.getByRole('link', { name: /BACK TO HOME PAGE/ });
    expect(back).toHaveAttribute('href', '/?nosplash=1');
  });
});

describe('AdminLayout — children', () => {
  it('renders the active panel inside the main landmark', () => {
    renderShell();
    expect(within(screen.getByRole('main')).getByText('panel content')).toBeInTheDocument();
  });
});

/* ── PF-109: the shell shares the site's background ─────────────── */

describe('AdminLayout — ambient layer (PF-109)', () => {
  it('mounts the starfield canvas — the same background as the main page', () => {
    // Owner decision 2026-09-16: main page, admin panel and login share
    // one background. PF-107 had deferred a separate lattice canvas;
    // this is the thing that replaced it. jsdom has no 2D context, so
    // the canvas draws nothing here — its presence is the assertion.
    const { container } = renderShell();
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('paints no opaque background on the shell, or the canvas is hidden', () => {
    // .shell used to declare `background: var(--bg)`. Over a fixed
    // z-index:0 canvas that is a full-page opaque plate — the starfield
    // renders and nobody sees it. Parsed, never text-searched: the rule's
    // own comment names the property it must not declare.
    const css = readFileSync(resolve(HERE, '../AdminLayout.module.css'), 'utf8');
    const shell = {};
    postcss.parse(css).walkRules('.shell', (r) => r.walkDecls((d) => { shell[d.prop] = d.value; }));
    expect(shell.composes).toBe('kf-fadeIn from global');   // proves the rule was found
    expect(shell.background).toBeUndefined();
    expect(shell['background-color']).toBeUndefined();
  });
});
