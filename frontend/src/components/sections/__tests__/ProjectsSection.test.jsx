// frontend/src/components/sections/__tests__/ProjectsSection.test.jsx
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MotionProvider } from '../../../providers/MotionProvider';

// vi.mock, not vi.spyOn on the module namespace — Vite's SSR transform
// defines each export as a getter-only property, so spyOn cannot
// redefine it. Same approach as SkillsSection.test.jsx.
const useProjects = vi.hoisted(() => vi.fn());
vi.mock('../../../hooks/useProjects', () => ({ useProjects }));
vi.mock('../../../hooks/useSiteNumbers', () => ({
  useSiteNumbers: () => ({ data: undefined, isLoading: true, isError: false, refetch: () => {}, isFetching: true }),
}));

const { ProjectsSection } = await import('../ProjectsSection');

const here     = dirname(fileURLToPath(import.meta.url));
const css      = readFileSync(resolve(here, '../ProjectsSection.module.css'), 'utf8');

/** The stylesheet with comments stripped.
 *
 *  ⚠️ Load-bearing, not tidiness. This module documents the values it
 *  deliberately omits — "NO transition", "NO background", the removed
 *  gradient — directly above the rules that omit them. A `not.toContain`
 *  over the raw text matches the COMMENT and passes while asserting
 *  nothing, which is the worst failure shape there is: a green test that
 *  reassures. Five of PF-83's raw-text guards were blind this way and
 *  every one was caught by mutation rather than by reading. */
const cssRules      = css.replace(/\/\*[\s\S]*?\*\//g, '');

/** The declaration block of a single rule, by exact selector, comments
 *  already stripped. */
function ruleBody(sheet, selector) {
  const i = sheet.indexOf(`\n${selector} {`);
  if (i === -1) throw new Error(`no rule for "${selector}"`);
  return sheet.slice(i, sheet.indexOf('}', i));
}

/** Parse `prop: value` pairs out of a rule body. */
function declarations(body) {
  const out = {};
  body.split('\n').slice(1).forEach((line) => {
    const m = /^\s*([a-z-]+)\s*:\s*(.+?);\s*$/.exec(line);
    if (m) out[m[1]] = m[2].trim();
  });
  return out;
}

/**
 * Element lookup by CSS-Module local name, matched EXACTLY.
 *
 * A `[class*="card"]` selector would match `cardBg`, `cardScrim`,
 * `cardTitle`, `cardDesc` and `cardPlaceholder`; `[class*="pill"]`
 * would match `pillRow`. PF-82 hit both and the miscounts read as
 * component bugs rather than selector bugs.
 */
function localName(token) {
  const scoped = /^_(.+)_[^_]+$/.exec(token);   // Vitest:   _card_f5cf21
  if (scoped) return scoped[1];
  const named = /__(.+)$/.exec(token);          // Vite dev: File-module__card
  return named ? named[1] : token;
}
const has = (el, name) => [...el.classList].some((c) => localName(c) === name);
const pickAll = (root, name) =>
  [...root.querySelectorAll('[class]')].filter((el) => has(el, name));
const pick = (root, name) => pickAll(root, name)[0] ?? null;

// PF-144: the cards are router Links.
const withMotion = (ui) => <MemoryRouter><MotionProvider>{ui}</MotionProvider></MemoryRouter>;

function mockMatchMedia(matches) {
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches, addEventListener: () => {}, removeEventListener: () => {},
  })));
}

/**
 * Shared fixture, DEEPLY frozen.
 *
 * PF-82 found that a shared mutable fixture disarms the very guard
 * watching it: a mutant that sorted the array in place during the first
 * test left the dedicated "does not mutate" check with nothing to
 * detect, so it passed. Running that one test alone caught it; running
 * the file did not — the worst shape for this to take. Freezing turns
 * every render in the file into a guard.
 */
const PROJECTS = Object.freeze([
  Object.freeze({
    _id: 'p1', title: 'ClearDrive.lk', slug: 'cleardrivelk', description: 'Vehicle import platform.',
    tech: Object.freeze(['Python', 'FastAPI', 'Next.js']),
    githubUrl: 'https://github.com/ClearDrive-lk/cleardrive-lk',
    liveUrl: 'https://cleardrive.lk/', featured: true, order: 1,
    backgroundImage: Object.freeze({ src: '', opacity: 0.75 }),
  }),
  Object.freeze({
    _id: 'p2', title: 'Personal Portfolio', slug: 'personal-portfolio', description: 'MERN portfolio.',
    tech: Object.freeze(['React 19', 'Node.js']),
    githubUrl: 'https://github.com/Chami-02/My_Portfolio',
    liveUrl: null, featured: true, order: 2,
    backgroundImage: Object.freeze({ src: '', opacity: 0.75 }),
  }),
  Object.freeze({
    _id: 'p3', title: 'Smart Campus API', slug: 'smart-campus-api', description: 'JAX-RS API.',
    tech: Object.freeze(['Java', 'JAX-RS']),
    githubUrl: 'https://github.com/Chami-02/CSA_CW_W2120595_smart-campus-api',
    liveUrl: null, featured: false, order: 3,
    backgroundImage: Object.freeze({ src: '', opacity: 0.75 }),
  }),
  Object.freeze({
    _id: 'p4', title: 'Life Below Water', slug: 'life-below-water', description: 'SDG 14 site.',
    tech: Object.freeze(['HTML', 'CSS']),
    githubUrl: 'https://github.com/Chami-02/WD-D_GP_Goal-14-Life-below-water',
    liveUrl: null, featured: false, order: 4,
    backgroundImage: Object.freeze({ src: '', opacity: 0.75 }),
  }),
]);

const SNAPSHOT = JSON.stringify(PROJECTS);

const ok = (data = PROJECTS) => ({
  data, isLoading: false, isError: false, error: null,
});

beforeEach(() => {
  mockMatchMedia(false);
  useProjects.mockReturnValue(ok());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ── 1 · the [id] scroll-margin trap ───────────────────────────────────
describe('section selector', () => {
  it('qualifies the class with the element name', () => {
    // A bare `.projects` is (0,1,0) — an exact tie with global.css:338's
    // `[id] { scroll-margin-top: 5rem }`, decided by stylesheet order,
    // which the global rule wins. That computes 80px against a 71px
    // header and lands the eyebrow 9px low with nothing in this module
    // looking wrong.
    expect(cssRules).toContain('section.projects {');
    expect(cssRules).not.toMatch(/\n\.projects\s*\{/);
  });

  it('sets scroll-margin-top from the header token', () => {
    expect(declarations(ruleBody(cssRules, 'section.projects')))
      .toMatchObject({ 'scroll-margin-top': 'var(--header-h)' });
  });

  // ── 2 · no section wash ─────────────────────────────────────────────
  it('declares no background of any kind', () => {
    // Three SEPARATE checks, not one grep for "background". The hero's
    // 74px lattice survived a combined grep on 2026-08-18 because it was
    // a background-image + background-size layer with no `background:`
    // shorthand and no section selector.
    const decls = declarations(ruleBody(cssRules, 'section.projects'));
    expect(decls.background).toBeUndefined();
    expect(decls['background-image']).toBeUndefined();
    expect(decls['background-size']).toBeUndefined();
  });
});

describe('the box beside the big card (PF-150)', () => {
  it('replaced the terminal for good', () => {
    const { container } = render(withMotion(<ProjectsSection />));
    expect(container.querySelector('[data-terminal]')).toBeNull();
    expect(screen.queryByText(/docker compose/)).toBeNull();
  });

  it('shares the Reveal row with the big card', () => {
    const { container } = render(withMotion(<ProjectsSection />));
    const box = screen.getByRole('region', { name: 'Site numbers' });
    expect(pick(container, 'featuredRow').contains(box)).toBe(true);
  });

  it('shows while the projects load, because it loads on its own', () => {
    useProjects.mockReturnValue({ data: undefined, isLoading: true, isError: false, error: null });
    render(withMotion(<ProjectsSection />));
    expect(screen.getByRole('region', { name: 'Site numbers' })).toBeTruthy();
  });

  it('names no keyframe anywhere in the module', () => {
    // A keyframe named inside a *.module.css is scoped and resolves to nothing.
    expect(cssRules).not.toMatch(/animation-name\s*:/);
    expect(cssRules).not.toMatch(/@keyframes/);
  });
});

// ── 13 · the fixture must survive the whole file ──────────────────────
describe('input purity', () => {
  it('never mutates the array it was given', () => {
    render(withMotion(<ProjectsSection />));
    expect(JSON.stringify(PROJECTS)).toBe(SNAPSHOT);
  });
});

// ── 14 · loading and error states ─────────────────────────────────────
describe('loading state', () => {
  it('shows placeholders, hidden from the accessibility tree', () => {
    useProjects.mockReturnValue({ data: undefined, isLoading: true, isError: false, error: null });
    const { container } = render(withMotion(<ProjectsSection />));
    expect(pickAll(container, 'cardPlaceholder')).toHaveLength(3);
    expect(pick(container, 'bigCardPlaceholder').getAttribute('aria-hidden')).toBe('true');
  });
});

describe('error state', () => {
  it('keeps the section, heading and #projects anchor', () => {
    // Navbar.jsx links to #projects. `return null` would turn that into
    // a dead anchor with no feedback at all.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    useProjects.mockReturnValue({
      data: undefined, isLoading: false, isError: true, error: new Error('boom'),
    });
    const { container } = render(withMotion(<ProjectsSection />));

    expect(container.querySelector('#projects')).toBeTruthy();
    expect(screen.getByText(/Built/)).toBeTruthy();
    expect(pickAll(container, 'grid')).toHaveLength(0);
    expect(container.querySelectorAll('[data-projectcard]')).toHaveLength(0);
  });

  it('logs once from an effect, not per render', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    useProjects.mockReturnValue({
      data: undefined, isLoading: false, isError: true, error: new Error('boom'),
    });
    const { rerender } = render(withMotion(<ProjectsSection />));
    rerender(withMotion(<ProjectsSection />));
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

// ── PF-144 — picture-on-top cards, at most four, VIEW ALL ──────────────────
describe('the cards (PF-144)', () => {
  const titles = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);

  it('puts the FIRST project by order in the big slot, the rest in the grid', () => {
    const { container } = render(withMotion(<ProjectsSection />));
    const cards = container.querySelectorAll('[data-projectcard]');
    expect(titles()).toEqual(['ClearDrive.lk', 'Personal Portfolio', 'Smart Campus API', 'Life Below Water']);
    expect(has(cards[0], 'big')).toBe(true);
    expect([...cards].slice(1).some((c) => has(c, 'big'))).toBe(false);
    expect(pick(container, 'featuredRow').contains(cards[0])).toBe(true);
  });

  it('shows at most FOUR — a fifth project is only on /projects', () => {
    const fifth = { ...PROJECTS[3], _id: 'p5', title: 'Fifth', slug: 'fifth', order: 5 };
    useProjects.mockReturnValue(ok([...PROJECTS, fifth]));
    render(withMotion(<ProjectsSection />));
    expect(titles()).toHaveLength(4);
    expect(titles()).not.toContain('Fifth');
  });

  it('each card is ONE link, to its own page', () => {
    render(withMotion(<ProjectsSection />));
    const card = screen.getByRole('link', { name: 'ClearDrive.lk' });
    expect(card).toHaveAttribute('href', '/projects/cleardrivelk');
  });

  it('VIEW ALL PROJECTS goes to /projects', () => {
    render(withMotion(<ProjectsSection />));
    expect(screen.getByRole('link', { name: 'VIEW ALL PROJECTS →' })).toHaveAttribute('href', '/projects');
  });

  it('no numerals and no GitHub links on the home cards any more', () => {
    render(withMotion(<ProjectsSection />));
    expect(screen.queryByText(/^0[2-5]$/)).toBeNull();
    expect(screen.queryByRole('link', { name: /GITHUB/ })).toBeNull();
  });

  it('badges every FEATURED project, big slot or not', () => {
    render(withMotion(<ProjectsSection />));
    const badged = screen.getAllByText('★ FEATURED').map((b) => b.closest('[data-projectcard]'));
    expect(badged.map((c) => within(c).getByRole('heading').textContent))
      .toEqual(['ClearDrive.lk', 'Personal Portfolio']);
  });
});

// PF-144 (owner, 2026-11-03): a failed load SAYS so, with TRY AGAIN.
describe('a failed load', () => {
  it('shows "didn\u2019t load" with TRY AGAIN, which refetches', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const refetch = vi.fn();
    useProjects.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new Error('x'), refetch, isFetching: false });
    render(withMotion(<ProjectsSection />));
    expect(screen.getByRole('status')).toHaveTextContent('The projects didn’t load.');
    screen.getByRole('button', { name: 'TRY AGAIN' }).click();
    expect(refetch).toHaveBeenCalled();
  });
});
