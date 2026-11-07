// PF-144 — /projects: every published project, with /blog's search.
// The URL is the state, so every test reads the location back rather than
// trusting what is on screen.
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ThemeProvider } from '../../providers/ThemeProvider';
import { MotionProvider } from '../../providers/MotionProvider';

const useProjects   = vi.hoisted(() => vi.fn());
const useVocabulary = vi.hoisted(() => vi.fn());
vi.mock('../../hooks/useProjects', () => ({ useProjects }));
vi.mock('../../hooks/useVocabulary', () => ({ useVocabulary }));

const { ProjectsPage } = await import('../ProjectsPage');

const P = (over) => Object.freeze({
  backgroundImage: { src: '' }, featured: false, role: '', client: '', startedOn: '', endedOn: '', ongoing: false,
  ...over,
});
const ALL = Object.freeze([
  P({ _id: '1', slug: 'alpha', title: 'Alpha', description: 'a', categories: ['Web App'], tech: ['React', 'Docker'] }),
  P({ _id: '2', slug: 'beta',  title: 'Beta',  description: 'b', categories: ['Mobile'],  tech: ['React Native'] }),
  P({ _id: '3', slug: 'gamma', title: 'Gamma', description: 'c', categories: ['Web App'], tech: ['Docker'] }),
]);
const VOCAB = {
  category: [{ value: 'Web App' }, { value: 'Mobile' }],
  tech: [{ value: 'Docker' }, { value: 'React' }, { value: 'React Native' }],
};

/** The server's filter, so the filtered list answers like the real API. */
const serve = ({ q = '', tech = [], category = '' } = {}) => ALL.filter((p) =>
  (!q || `${p.title} ${p.description}`.toLowerCase().includes(q.toLowerCase())) &&
  (!category || p.categories.includes(category)) &&
  tech.every((t) => p.tech.includes(t)));

let location;
const Spy = () => { location = useLocation(); return null; };

function draw(url = '/projects', { list } = {}) {
  useProjects.mockImplementation((params = {}) => ({
    data: list ?? serve(params), isLoading: false, isError: false, isFetching: false, refetch: vi.fn(),
  }));
  useVocabulary.mockImplementation((type) => ({ data: VOCAB[type] }));
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ThemeProvider>
        <MotionProvider>
          <Routes><Route path="/projects" element={<><ProjectsPage /><Spy /></>} /></Routes>
        </MotionProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

// PF-154: h2 — the cards sit straight under the page's h1.
const titles = () => screen.queryAllByRole('heading', { level: 2 }).map((h) => h.textContent);
const group = (name) => screen.getByRole('group', { name: `Filter by ${name}` });
const chip = (groupName, label) => within(group(groupName)).getByRole('button', { name: label });

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })));
  window.scrollTo = vi.fn();
});
afterEach(() => { vi.useRealTimers(); });

describe('ProjectsPage — the list', () => {
  it('shows every published project as a card, with the total', () => {
    draw();
    expect(titles()).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(screen.getByText('3 PROJECTS · ALL')).toBeInTheDocument();
  });

  it('chips come from the IN-USE vocabularies, one row each', () => {
    draw();
    expect(useVocabulary).toHaveBeenCalledWith('category', { inUse: true });
    expect(useVocabulary).toHaveBeenCalledWith('tech', { inUse: true });
    expect(within(group('category')).getAllByRole('button').map((b) => b.textContent))
      .toEqual(['All', 'Web App', 'Mobile']);
  });

  it('reads the filters from the URL and passes them to the query', () => {
    draw('/projects?q=al&category=Web+App&tech=React&tech=Docker');
    expect(useProjects).toHaveBeenCalledWith({ q: 'al', tech: ['React', 'Docker'], category: 'Web App' });
    expect(titles()).toEqual(['Alpha']);
    expect(screen.getByText('1 OF 3 PROJECTS')).toBeInTheDocument();
  });

  it('a card carries the search, for ← BACK TO RESULTS', () => {
    draw('/projects?tech=Docker');
    // The card's link is the title; its state is checked by ProjectCard's
    // own test — here, that the page HANDS it over.
    expect(screen.getByRole('link', { name: 'Alpha' })).toHaveAttribute('href', '/projects/alpha');
  });
});

describe('ProjectsPage — chips', () => {
  it('CATEGORY takes ONE: a second pick replaces the first, the picked one again clears it', async () => {
    const user = userEvent.setup();
    draw();
    await user.click(chip('category', 'Web App'));
    expect(location.search).toBe('?category=Web+App');
    await user.click(chip('category', 'Mobile'));
    expect(location.search).toBe('?category=Mobile');
    await user.click(chip('category', 'Mobile'));
    expect(location.search).toBe('');
  });

  it('TECH takes several (ANDed); "All" clears them', async () => {
    const user = userEvent.setup();
    draw();
    await user.click(chip('tech', 'Docker'));
    await user.click(chip('tech', 'React'));
    expect(new URLSearchParams(location.search).getAll('tech')).toEqual(['Docker', 'React']);
    expect(titles()).toEqual(['Alpha']);
    await user.click(chip('tech', 'All'));
    expect(location.search).toBe('');
  });

  it('a chip that would find NOTHING is disabled — a picked one never is', () => {
    draw('/projects?category=Mobile');
    // No Mobile project uses Docker.
    expect(chip('tech', 'Docker')).toBeDisabled();
    expect(chip('tech', 'React Native')).toBeEnabled();
    expect(chip('category', 'Mobile')).toBeEnabled();
    expect(chip('category', 'Mobile')).toHaveAttribute('aria-pressed', 'true');
  });

  it('chips are type="button" — inside the search form, they must not submit it', () => {
    draw();
    within(group('tech')).getAllByRole('button').forEach((b) => expect(b).toHaveAttribute('type', 'button'));
  });
});

describe('ProjectsPage — the search box', () => {
  it('typing is debounced into ?q= and REPLACES history', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    draw();
    await user.type(screen.getByRole('textbox', { name: /Search projects/ }), 'gam');
    expect(location.search).toBe('');
    await act(async () => { vi.advanceTimersByTime(350); });
    expect(location.search).toBe('?q=gam');
    expect(titles()).toEqual(['Gamma']);
  });

  it('Enter searches at once', async () => {
    const user = userEvent.setup();
    draw();
    await user.type(screen.getByRole('textbox', { name: /Search projects/ }), ' beta {Enter}');
    expect(location.search).toBe('?q=beta');
  });
});

describe('ProjectsPage — filters row and empty states', () => {
  it('FILTERING BY names each filter; each pill clears its own; CLEAR ALL clears everything', async () => {
    const user = userEvent.setup();
    draw('/projects?q=a&category=Web+App&tech=Docker');
    expect(screen.getByText('FILTERING BY')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear the Docker tech filter' }));
    expect(new URLSearchParams(location.search).getAll('tech')).toEqual([]);
    expect(new URLSearchParams(location.search).get('category')).toBe('Web App');
    await user.click(screen.getByRole('button', { name: 'CLEAR ALL' }));
    expect(location.search).toBe('');
  });

  it('no match says WHAT was searched, and offers RESET FILTERS', () => {
    draw('/projects?q=zzz&tech=Docker');
    expect(screen.getByRole('status')).toHaveTextContent('No projects "zzz" built with DOCKER.');
    expect(screen.getByRole('button', { name: 'RESET FILTERS' })).toBeInTheDocument();
  });

  it('no projects at all is a different message, with nothing to reset', () => {
    draw('/projects', { list: [] });
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'RESET FILTERS' })).toBeNull();
    // No "0 PROJECTS" pill for an empty or failed list.
    expect(screen.queryByText(/PROJECTS · ALL/)).toBeNull();
  });

  it('a failed load says so and offers TRY AGAIN — never the empty state', () => {
    useVocabulary.mockImplementation((type) => ({ data: VOCAB[type] }));
    useProjects.mockImplementation(() => ({ data: undefined, isLoading: false, isError: true, error: new Error('x'), isFetching: false, refetch: vi.fn() }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <MemoryRouter initialEntries={['/projects']}>
        <ThemeProvider><MotionProvider><ProjectsPage /></MotionProvider></ThemeProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('The projects are not loading');
    expect(screen.queryByText('Nothing here yet')).toBeNull();
  });
});
