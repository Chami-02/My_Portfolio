// frontend/src/components/admin/panels/__tests__/AdminOverviewPanel.test.jsx
//
// PF-110 — the rebuilt Overview panel. Behaviour, not pixels: the four
// cards and which stat each shows, the greeting, the loading and error
// states, and where each quick action sends the page.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const useDashboardStats = vi.hoisted(() => vi.fn());
vi.mock('../../../../hooks/useDashboardStats', () => ({ useDashboardStats }));

const { AdminOverviewPanel } = await import('../AdminOverviewPanel');

// Every figure distinct, and the ones the cards do NOT show (posts,
// drafts, messages) distinct from the ones they do — so a card wired to
// the wrong field, or to a total instead of a subset, fails.
const STATS = {
  projects: 4, skills: 1, posts: 5, published: 3, drafts: 2, messages: 6, unread: 5,
};

const card = (label) => screen.getByText(label).closest('div');

beforeEach(() => {
  vi.clearAllMocks();
  useDashboardStats.mockReturnValue({ data: STATS, isError: false, refetch: vi.fn() });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AdminOverviewPanel — welcome', () => {
  it('greets by the local hour', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 16, 15, 0)); // 15:00 local
    render(<AdminOverviewPanel onNavigate={vi.fn()} />);
    expect(screen.getByText(/ADMIN CONSOLE · GOOD AFTERNOON/)).toBeInTheDocument();
  });

  it('renders the prototype heading with the name as the outlined word', () => {
    render(<AdminOverviewPanel onNavigate={vi.fn()} />);
    const h2 = screen.getByRole('heading', { level: 2 });
    expect(h2).toHaveTextContent('Welcome back, Parindra');
    // The outline is a class the stylesheet owns; what the DOM must
    // guarantee is that ONLY the name is wrapped, not the whole line.
    const outlined = h2.querySelector('span');
    expect(outlined).toHaveTextContent('Parindra');
    expect(outlined.textContent).toBe('Parindra');
  });
});

describe('AdminOverviewPanel — stat cards', () => {
  it('renders the four prototype cards, in order, with the prototype glyphs', () => {
    render(<AdminOverviewPanel onNavigate={vi.fn()} />);
    const labels = ['PROJECTS', 'SKILLS', 'PUBLISHED POSTS', 'UNREAD MESSAGES'];
    for (const l of labels) expect(screen.getByText(l)).toBeInTheDocument();

    // Order matters — it is the prototype's, and it is the sidebar's.
    const all = labels.map((l) => screen.getByText(l));
    for (let i = 1; i < all.length; i++) {
      expect(all[i - 1].compareDocumentPosition(all[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }

    // Geometric glyphs, not colour emoji. PF-107 made the same swap on
    // the sidebar (📝 → ✎) for the same reason: emoji render at a
    // different weight and baseline from the glyphs beside them, and
    // differ per operating system.
    expect(card('PUBLISHED POSTS')).toHaveTextContent('✎');
    expect(card('UNREAD MESSAGES')).toHaveTextContent('✉');
    expect(document.body.textContent).not.toMatch(/📝|👤/u);
  });

  it('shows PUBLISHED (not total posts) and UNREAD (not total messages)', () => {
    render(<AdminOverviewPanel onNavigate={vi.fn()} />);
    expect(card('PROJECTS')).toHaveTextContent('4');
    expect(card('SKILLS')).toHaveTextContent('1');
    expect(within(card('PUBLISHED POSTS')).getByText('3')).toBeInTheDocument();
    expect(within(card('UNREAD MESSAGES')).getByText('5')).toBeInTheDocument();
    // The totals that would appear if a card read the wrong field.
    expect(within(card('PUBLISHED POSTS')).queryByText('5')).toBeNull();
    expect(within(card('UNREAD MESSAGES')).queryByText('6')).toBeNull();
  });

  it('renders a real 0, not an empty slot', () => {
    useDashboardStats.mockReturnValue({ data: { ...STATS, unread: 0 }, isError: false, refetch: vi.fn() });
    render(<AdminOverviewPanel onNavigate={vi.fn()} />);
    expect(within(card('UNREAD MESSAGES')).getByText('0')).toBeInTheDocument();
  });

  // The Phase 1 panel defaulted every list to [] and painted 0 / 0 / 0
  // before the request landed. No number at all is the correct state.
  it('shows no number while the stats are loading', () => {
    useDashboardStats.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() });
    render(<AdminOverviewPanel onNavigate={vi.fn()} />);
    for (const l of ['PROJECTS', 'SKILLS', 'PUBLISHED POSTS', 'UNREAD MESSAGES']) {
      expect(card(l).textContent).not.toMatch(/[0-9]/);
    }
    // The four cards are still there — layout does not jump on arrival.
    expect(screen.getAllByText(/PROJECTS|SKILLS|PUBLISHED POSTS|UNREAD MESSAGES/)).toHaveLength(4);
  });

  it('surfaces a failed fetch as an alert with a working RETRY', async () => {
    const refetch = vi.fn();
    useDashboardStats.mockReturnValue({ data: undefined, isError: true, refetch });
    const user = userEvent.setup();
    render(<AdminOverviewPanel onNavigate={vi.fn()} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/COULDN.T LOAD THE DASHBOARD COUNTS/);
    await user.click(within(alert).getByRole('button', { name: 'RETRY' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('renders no alert when the fetch succeeded', () => {
    render(<AdminOverviewPanel onNavigate={vi.fn()} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('AdminOverviewPanel — quick actions', () => {
  it.each([
    ['+ NEW PROJECT', 'projects', false],
    ['+ NEW POST',    'blog',     true ],
    ['+ NEW SKILL',   'skills',   false],
    ['EDIT PROFILE',  'about',    false],
  ])('%s navigates to %s (compose: %s)', async (label, tab, compose) => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(<AdminOverviewPanel onNavigate={onNavigate} />);

    await user.click(screen.getByRole('button', { name: label }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith(tab, { compose });
  });

  // A <button> with no type is a submit button. None of these are inside
  // a form today; the guard is against the day one is.
  it('every button is type="button"', () => {
    render(<AdminOverviewPanel onNavigate={vi.fn()} />);
    for (const b of screen.getAllByRole('button')) {
      expect(b).toHaveAttribute('type', 'button');
    }
  });

  it('names the row JUMP BACK IN, as the prototype does', () => {
    render(<AdminOverviewPanel onNavigate={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('JUMP BACK IN');
  });
});
