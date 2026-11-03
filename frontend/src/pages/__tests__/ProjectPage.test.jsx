// PF-144 — /projects/:slug, one project's page. Rendered through a real
// <Route> so `useParams()` is exercised, never a hand-passed slug.
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postcss from 'postcss';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../providers/ThemeProvider';
import { MotionProvider } from '../../providers/MotionProvider';

const useProject = vi.hoisted(() => vi.fn());
vi.mock('../../hooks/useProjects', () => ({ useProject }));

const { ProjectPage } = await import('../ProjectPage');

const css = postcss.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../ProjectPage.module.css'), 'utf8'));
const decl = (selector, prop) => {
  let value;
  css.walkRules((r) => { if (r.selector === selector) r.walkDecls(prop, (d) => { value = d.value; }); });
  return value;
};

const PROJECT = Object.freeze({
  _id: 'p1', slug: 'cleardrivelk', title: 'ClearDrive.lk', description: 'Vehicle import platform.',
  categories: Object.freeze(['Web App']), role: 'Team lead', client: 'ClearDrive.lk',
  startedOn: '2024-02', endedOn: '', ongoing: true,
  githubUrl: 'https://github.com/ClearDrive-lk/cleardrive-lk', liveUrl: 'https://cleardrive.lk/',
  tech: Object.freeze(['FastAPI', 'Next.js']),
  backgroundImage: Object.freeze({ src: 'https://res.cloudinary.com/x/image/upload/v1/p/a.webp' }),
  sections: Object.freeze([
    Object.freeze({ heading: 'Description', body: Object.freeze(['What it is.']), bullets: Object.freeze([]) }),
    Object.freeze({ heading: 'Key Features', body: Object.freeze([]), bullets: Object.freeze(['Auctions', 'Payments']) }),
  ]),
});
const PREV = Object.freeze({ slug: 'portfolio', title: 'Personal Portfolio' });
const NEXT = Object.freeze({ slug: 'smart-campus-api', title: 'Smart Campus API' });

const ok      = (over = {}) => ({ data: { project: PROJECT, prev: PREV, next: NEXT, index: 0, total: 3, ...over }, isLoading: false, isError: false });
const loading = () => ({ data: undefined, isLoading: true, isError: false });
const failed  = (status = 404) => ({ data: undefined, isLoading: false, isError: true, refetch: vi.fn(),
  error: status ? { response: { status } } : new Error('Network Error') });

function draw({ query = ok(), state } = {}) {
  useProject.mockImplementation(() => query);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[{ pathname: '/projects/cleardrivelk', state }]}>
        <ThemeProvider>
          <MotionProvider>
            <Routes><Route path="/projects/:slug" element={<ProjectPage />} /></Routes>
          </MotionProvider>
        </ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })));
  window.scrollTo = vi.fn();
});

describe('ProjectPage', () => {
  it('reads the slug from the URL', () => {
    draw();
    expect(useProject).toHaveBeenCalledWith('cleardrivelk');
  });

  it('shows the header: category, dates, title, summary, role and client', () => {
    draw();
    expect(screen.getByText('Web App')).toBeInTheDocument();
    expect(screen.getByText('FEB 2024 – PRESENT')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'ClearDrive.lk' })).toBeInTheDocument();
    expect(screen.getByText('Vehicle import platform.')).toBeInTheDocument();
    expect(screen.getByText('ROLE').nextSibling).toHaveTextContent('Team lead');
    expect(screen.getByText('CLIENT').nextSibling).toHaveTextContent('ClearDrive.lk');
  });

  it('the GitHub and LIVE SITE links moved here, opening safely in a new tab', () => {
    draw();
    for (const name of [/VIEW ON GITHUB/, /LIVE SITE/]) {
      const link = screen.getByRole('link', { name });
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noreferrer');
    }
  });

  it('no LIVE SITE without a live URL', () => {
    draw({ query: ok({ project: { ...PROJECT, liveUrl: null } }) });
    expect(screen.queryByRole('link', { name: /LIVE SITE/ })).toBeNull();
  });

  it('the big picture is described, and asked for at page size', () => {
    draw();
    const img = screen.getByRole('img', { name: 'ClearDrive.lk — screenshot' });
    expect(img.getAttribute('src')).toContain('/upload/c_limit,w_1640,f_auto,q_auto/');
  });

  it('numbers the sections, then Tech Stack after them', () => {
    draw();
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['01Description', '02Key Features', '03Tech Stack']);
    expect(screen.getByText('Auctions')).toBeInTheDocument();
    expect(within(screen.getByRole('list')).getAllByRole('listitem').map((li) => li.textContent))
      .toEqual(['FastAPI', 'Next.js']);
  });

  it('prev / next, carrying the router state so BACK TO RESULTS survives a hop', () => {
    draw({ state: { from: 'q=car' } });
    const nav = screen.getByRole('navigation', { name: 'More projects' });
    expect(within(nav).getByRole('link', { name: /PREVIOUS/ })).toHaveAttribute('href', '/projects/portfolio');
    expect(within(nav).getByRole('link', { name: /NEXT/ })).toHaveAttribute('href', '/projects/smart-campus-api');
  });

  it('← ALL PROJECTS at both ends, by default', () => {
    draw();
    const backs = screen.getAllByRole('link', { name: '← ALL PROJECTS' });
    expect(backs).toHaveLength(2);
    backs.forEach((b) => expect(b).toHaveAttribute('href', '/projects'));
  });

  it('← BACK TO RESULTS when /projects sent a search', () => {
    draw({ state: { from: 'q=car&tech=React' } });
    const backs = screen.getAllByRole('link', { name: '← BACK TO RESULTS' });
    expect(backs).toHaveLength(2);
    backs.forEach((b) => expect(b).toHaveAttribute('href', '/projects?q=car&tech=React'));
  });

  it('loading: a placeholder, nothing else', () => {
    draw({ query: loading() });
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  // Found in the phone pass: a 429 showed "That project is not here".
  it.each([[429], [500], [null]])('a %s failure says NOT LOADING with TRY AGAIN — never "not here"', async (status) => {
    const query = failed(status);
    draw({ query });
    expect(screen.getByRole('alert')).toHaveTextContent('The project is not loading');
    expect(screen.queryByText('That project is not here')).toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'TRY AGAIN' }));
    expect(query.refetch).toHaveBeenCalled();
  });

  it('not found: an inline panel that keeps the URL, with ONE way to every project', () => {
    draw({ query: failed() });
    expect(screen.getByRole('status')).toHaveTextContent('That project is not here');
    expect(screen.getByRole('link', { name: 'SEE EVERY PROJECT →' })).toHaveAttribute('href', '/projects');
  });

  it('keeps --ok on the LIVE SITE dot (themed surface) and the dot-ok carrier', () => {
    expect(decl('.liveDot', 'background')).toBe('var(--ok)');
    expect(decl('.liveDot', 'composes')).toBe('kf-dot-ok from global');
  });
});

// ── PF-144 part 2 — a section's pictures ───────────────────────────────────
describe('ProjectPage — section pictures', () => {
  const PICS = [
    { publicId: 'p/a', url: 'https://res.cloudinary.com/x/image/upload/v1/a.png', caption: 'Dashboard', width: 1920, height: 1080 },
    { publicId: 'p/b', url: 'https://res.cloudinary.com/x/image/upload/v1/b.png', caption: '', width: 1920, height: 1080 },
  ];
  const withPics = (images) => ok({ project: { ...PROJECT, sections: [
    { heading: 'Screens', body: ['Text after the pictures.'], bullets: [], images },
  ] } });

  it('shows them under the heading, ABOVE the text, each a button with a name', () => {
    draw({ query: withPics(PICS) });
    const heading = screen.getByRole('heading', { level: 2, name: /Screens/ });
    const first = screen.getByRole('button', { name: 'Open Dashboard larger' });
    const text = screen.getByText('Text after the pictures.');
    expect(heading.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(first.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open Screens — picture 2 larger' })).toBeInTheDocument();
    expect(screen.getByText('Dashboard', { selector: 'figcaption' })).toBeInTheDocument();
  });

  it('reserves each picture\'s box (width/height) so the text never jumps', () => {
    draw({ query: withPics(PICS) });
    const img = screen.getByRole('img', { name: 'Dashboard' });
    expect(img).toHaveAttribute('width', '1920');
    expect(img).toHaveAttribute('height', '1080');
  });

  it('a click opens the big view on THAT picture; Esc closes it', async () => {
    draw({ query: withPics(PICS) });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Open Screens — picture 2 larger' }));
    expect(screen.getByRole('dialog', { name: 'Screens' })).toBeInTheDocument();
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('a section without pictures shows none', () => {
    draw();
    expect(screen.queryByRole('button', { name: /larger/ })).toBeNull();
  });
});
