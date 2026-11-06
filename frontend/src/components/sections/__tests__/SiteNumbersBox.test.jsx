// frontend/src/components/sections/__tests__/SiteNumbersBox.test.jsx
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import postcss from 'postcss';
import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const useSiteNumbers = vi.hoisted(() => vi.fn());
vi.mock('../../../hooks/useSiteNumbers', () => ({ useSiteNumbers }));

const { SiteNumbersBox } = await import('../SiteNumbersBox');

const here = dirname(fileURLToPath(import.meta.url));

const NOW = new Date('2026-11-06T12:00:00Z').getTime();

const NUMBERS = Object.freeze({
  visits: 1299,
  countriesReached: 14,
  blogReads: 860,
  topCountries: Object.freeze(['LK', 'GB']),
  topProjects: Object.freeze([{ slug: 'cleardrivelk', title: 'ClearDrive.lk' }]),
  topPosts: Object.freeze([{ slug: 'first-post', title: 'First Post' }]),
  updatedAt: new Date(NOW - 12 * 60_000).toISOString(),
});

const loaded = (data = NUMBERS) => ({ data, isError: false, isFetching: false, refetch: vi.fn() });
const show = () => render(<MemoryRouter><SiteNumbersBox /></MemoryRouter>);
const box = () => screen.getByRole('region', { name: 'Site numbers' });

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date', 'setInterval', 'clearInterval'] });
  useSiteNumbers.mockReturnValue(loaded());
});
afterEach(() => vi.useRealTimers());

describe('the numbers', () => {
  it('pairs each number with its own label, rounded from 1,000', () => {
    show();
    const terms = screen.getAllByRole('term').map((t) => t.textContent);
    const values = screen.getAllByRole('definition').map((d) => d.textContent);
    expect(terms).toEqual(['VISITS', 'COUNTRIES', 'BLOG READS']);
    expect(values).toEqual(['1.2k', '14', '860']);
  });

  it('shows real small numbers from day one, zero included', () => {
    useSiteNumbers.mockReturnValue(loaded({ ...NUMBERS, visits: 0, countriesReached: 0, blogReads: 8 }));
    show();
    expect(screen.getAllByRole('definition').map((d) => d.textContent)).toEqual(['0', '0', '8']);
  });
});

describe('top countries', () => {
  it('shows country names, not codes', () => {
    show();
    expect(screen.getByText('Sri Lanka')).toBeTruthy();
    expect(screen.getByText('United Kingdom')).toBeTruthy();
    expect(screen.queryByText('LK')).toBeNull();
  });

  it('the whole part stays hidden until a country qualifies', () => {
    useSiteNumbers.mockReturnValue(loaded({ ...NUMBERS, topCountries: [] }));
    show();
    expect(screen.queryByText('TOP COUNTRIES')).toBeNull();
  });
});

describe('the lists', () => {
  it('each title links to its own page', () => {
    show();
    expect(screen.getByRole('link', { name: 'ClearDrive.lk' })).toHaveAttribute('href', '/projects/cleardrivelk');
    expect(screen.getByRole('link', { name: 'First Post' })).toHaveAttribute('href', '/blog/first-post');
  });

  it('an empty list says so', () => {
    useSiteNumbers.mockReturnValue(loaded({ ...NUMBERS, topProjects: [], topPosts: [] }));
    show();
    expect(screen.getByText('No project views counted yet.')).toBeTruthy();
    expect(screen.getByText('No reads counted yet.')).toBeTruthy();
  });

  it('has no link to how it is counted (owner, 2026-11-06)', () => {
    show();
    expect(within(box()).queryByText(/COUNTED/)).toBeNull();
    expect(within(box()).getAllByRole('link')).toHaveLength(2);
  });
});

describe('how fresh the numbers are', () => {
  it('says how old they are, and never claims to be live', () => {
    show();
    expect(screen.getByText('Updated 12 minutes ago')).toBeTruthy();
    expect(box().textContent).not.toMatch(/live/i);
  });

  it('stays true in a tab left open', () => {
    show();
    act(() => { vi.advanceTimersByTime(3 * 60_000); });
    expect(screen.getByText('Updated 15 minutes ago')).toBeTruthy();
  });

  it('stops its clock when it leaves the page', () => {
    const { unmount } = show();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('loading and failing', () => {
  it('while loading shows the box with no number at all', () => {
    useSiteNumbers.mockReturnValue({ data: undefined, isError: false, isFetching: true, refetch: vi.fn() });
    show();
    expect(screen.queryAllByRole('definition')).toHaveLength(0);
    expect(screen.queryByText(/Updated/)).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('a failed load says so, with TRY AGAIN, and shows no numbers', () => {
    const refetch = vi.fn();
    useSiteNumbers.mockReturnValue({ data: undefined, isError: true, isFetching: false, refetch });
    show();
    expect(screen.getByRole('status')).toHaveTextContent('The site numbers didn’t load.');
    expect(screen.queryAllByRole('definition')).toHaveLength(0);
    screen.getByRole('button', { name: 'TRY AGAIN' }).click();
    expect(refetch).toHaveBeenCalled();
  });

  it('a failed refresh keeps the numbers already on screen', () => {
    useSiteNumbers.mockReturnValue({ ...loaded(), isError: true });
    show();
    expect(screen.getAllByRole('definition')).toHaveLength(3);
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('both themes (owner, 2026-11-06)', () => {
  const root = postcss.parse(readFileSync(resolve(here, '../SiteNumbersBox.module.css'), 'utf8'));

  it('paints no literal colour anywhere, so it can never be stuck on one theme', () => {
    const literal = /#[0-9a-f]{3,8}\b|rgba?\(\s*\d/i;
    const found = [];
    let seen = 0;
    root.walkDecls(/color$|^background|^border|box-shadow/, (decl) => {
      seen += 1;
      if (literal.test(decl.value)) found.push(`${decl.prop}: ${decl.value}`);
    });
    expect(seen).toBeGreaterThan(15);
    expect(found).toEqual([]);
  });

  it('one hue per subject, each a colour that is set per theme', () => {
    const tones = {};
    root.walkDecls('--tone', (decl) => { tones[decl.parent.selector] = decl.value; });
    expect(tones).toEqual({
      '.toneVisits': 'var(--acc)',
      '.toneCountries': 'var(--chart-5)',
      '.toneProjects': 'var(--chart-2)',
      '.toneReads': 'var(--chart-3)',
    });
  });

  it('gives paper a lighter shadow', () => {
    const selectors = [];
    root.walkRules((rule) => {
      if (rule.some((node) => node.prop === 'box-shadow')) selectors.push(rule.selector);
    });
    expect(selectors).toContain(":global(html[data-theme='light']) .box");
  });
});
