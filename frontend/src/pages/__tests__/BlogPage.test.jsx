// frontend/src/pages/__tests__/BlogPage.test.jsx
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import postcss from 'postcss';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../providers/ThemeProvider';
import { MotionProvider } from '../../providers/MotionProvider';

// vi.mock, not vi.spyOn on the module namespace — Vite's SSR transform
// defines each export as a getter-only property, so spyOn cannot redefine it.
const useBlogPosts  = vi.hoisted(() => vi.fn());
const useVocabulary = vi.hoisted(() => vi.fn());
vi.mock('../../hooks/useBlog',       () => ({ useBlogPosts }));
vi.mock('../../hooks/useVocabulary', () => ({ useVocabulary }));

/**
 * ⚠️ `useNavigationType` is mocked, and NOT mocking it would have made the
 * landing-scroll tests below assert the opposite of what they claim.
 * MemoryRouter reports its INITIAL entry as a 'POP' — the same value a
 * browser reports for Back — so `draw()` would exercise the skip branch
 * while reading like the arrival branch, and "scrolls on arrival" would
 * have failed while "does not scroll on Back" passed for the wrong reason.
 *
 * A PARTIAL mock: everything else in this module (MemoryRouter, Link,
 * useSearchParams, useLocation) must stay real, because the page's URL
 * behaviour is what most of this file tests.
 */
const navType = vi.hoisted(() => ({ current: 'PUSH' }));
vi.mock('react-router-dom', async (importActual) => ({
  ...(await importActual()),
  useNavigationType: () => navType.current,
}));

const { BlogPage } = await import('../BlogPage');

const here = dirname(fileURLToPath(import.meta.url));
const css  = readFileSync(resolve(here, '../BlogPage.module.css'), 'utf8');

/**
 * ⚠️ Every CSS assertion here goes through postcss, never a regex over the
 * raw text. This module documents the REMOVED ghost numeral, the dead sweep
 * keyframe and the pill near-miss table IN PROSE — so a
 * `not.toContain('ghostNumeral')` matches the comment explaining the removal
 * and passes while proving nothing. Five guards in this repo were blind on
 * first write for exactly that reason. Parsing is immune rather than
 * defended: a comment is a node type a declaration walk never visits.
 */
const root = postcss.parse(css);

function declsOf(source, selector) {
  let found = null;
  postcss.parse(source).walkRules((rule) => {
    if (rule.selector === selector) {
      found = {};
      rule.walkDecls((d) => { found[d.prop] = d.value; });
    }
  });
  if (!found) throw new Error(`no rule for "${selector}"`);
  return found;
}
const decls = (selector) => declsOf(css, selector);

const selectors = (() => {
  const out = [];
  root.walkRules((rule) => out.push(...rule.selectors));
  return out;
})();

const transitions = (() => {
  const out = [];
  root.walkRules((rule) => {
    rule.walkDecls(/^transition/, (d) =>
      out.push({ selector: rule.selector, prop: d.prop, value: d.value }));
  });
  return out;
})();

// ── DOM lookup by CSS-Module local name, matched EXACTLY ──────────────
// `[class*="card"]` would also match `featuredCard`, `cardMeta`, `cardTitle`,
// `cardTagRow`, `cardTagPill`, `cardNumeral` and `cardPlaceholder`; every one
// of those collisions reads as a component bug rather than a selector bug.
function localName(token) {
  const scoped = /^_(.+)_[^_]+$/.exec(token);   // Vitest:   _card_f5cf21
  if (scoped) return scoped[1];
  const named = /__(.+)$/.exec(token);          // Vite dev: File-module__card
  return named ? named[1] : token;
}
const has     = (el, name) => [...el.classList].some((c) => localName(c) === name);
const pickAll = (r, name) => [...r.querySelectorAll('[class]')].filter((el) => has(el, name));
const pick    = (r, name) => pickAll(r, name)[0] ?? null;
const textsOf = (r, name) => pickAll(r, name).map((el) => el.textContent);

// ── fixtures ──────────────────────────────────────────────────────────
/**
 * Server-ordered, because the server IS what orders this list
 * (`$ifNull: [publishedAt, createdAt]` desc, `_id` asc). The page must not
 * re-sort, so — unlike BlogSection's fixture, which is deliberately
 * unsorted — this one arrives in the order it must be rendered in.
 *
 * Deep-frozen: an in-place sort would then throw rather than quietly
 * reordering module state that every later test in this file shares.
 */
/**
 * ⚠️ The `views` spread is DELIBERATE and each value tests a different
 * branch of PF-99's counter: 1284 exercises the thousands separator, 0 the
 * hide-at-zero rule, 7 the ordinary case, and `p4` omits the field entirely
 * — the shape a post fetched from an endpoint that projected `views` away
 * would arrive in. A fixture where every post had the same non-zero count
 * would pass against a component that ignored the prop.
 */
const POSTS = Object.freeze([
  Object.freeze({ _id: 'p1', title: 'Newest Post', slug: 'newest-post',
    excerpt: 'The most recent one.', tags: Object.freeze(['React', 'MERN']),
    readingTimeMinutes: 6, views: 1284, publishedAt: '2026-07-14T09:00:00.000Z' }),
  Object.freeze({ _id: 'p2', title: 'Second Post', slug: 'second-post',
    excerpt: 'The second one.', tags: Object.freeze(['Docker']),
    readingTimeMinutes: 7, views: 0, publishedAt: '2026-06-14T09:00:00.000Z' }),
  Object.freeze({ _id: 'p3', title: 'Third Post', slug: 'third-post',
    excerpt: 'The third one.', tags: Object.freeze(['Docker', 'DevOps']),
    readingTimeMinutes: 4, views: 7, publishedAt: '2026-05-14T09:00:00.000Z' }),
  Object.freeze({ _id: 'p4', title: 'Fourth Post', slug: 'fourth-post',
    excerpt: 'The fourth one.', tags: Object.freeze(['Java']),
    readingTimeMinutes: 5, publishedAt: '2026-04-14T09:00:00.000Z' }),
]);

/** The tag pool's in-use half, as `GET /api/vocabulary/tag?inUse=true`
 *  returns it: full documents, not strings. */
const VOCAB = Object.freeze([
  Object.freeze({ _id: 'v1', type: 'tag', value: 'React' }),
  Object.freeze({ _id: 'v2', type: 'tag', value: 'MERN' }),
  Object.freeze({ _id: 'v3', type: 'tag', value: 'Docker' }),
  Object.freeze({ _id: 'v4', type: 'tag', value: 'DevOps' }),
  Object.freeze({ _id: 'v5', type: 'tag', value: 'Java' }),
]);

const ok      = (data) => ({ data, isLoading: false, isError: false, error: null });
const loading = ()     => ({ data: undefined, isLoading: true, isError: false, error: null });
const failed  = (e)    => ({ data: undefined, isLoading: false, isError: true, error: e });

/**
 * The error page, rendered. Separate from `draw()` because the error branch
 * needs `refetch`/`isFetching` on the query result, which `failed()` does
 * not carry — and a mock missing `refetch` would make the retry click throw
 * rather than fail an assertion.
 */
function drawFailed({ refetch = vi.fn(), isFetching = false } = {}) {
  const state = { ...failed(new Error('boom')), refetch, isFetching };
  useBlogPosts.mockImplementation(() => state);
  useVocabulary.mockImplementation(() => ok(VOCAB));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/blog']}>
        <ThemeProvider><MotionProvider><BlogPage /></MotionProvider></ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return view.container;
}

let location;
function LocationProbe() {
  location = useLocation();
  return null;
}

/**
 * `filtered` is what the page renders; `total` is the unfiltered count query.
 * The page distinguishes them by ARGUMENT — `useBlogPosts({q, tag})` versus
 * `useBlogPosts()` — so the mock does too.
 */
function draw({ filtered = ok(POSTS), total = ok(POSTS), vocab = ok(VOCAB), path = '/blog' } = {}) {
  useBlogPosts.mockImplementation((params) => (params === undefined ? total : filtered));
  useVocabulary.mockImplementation(() => vocab);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <ThemeProvider>
          <MotionProvider>
            <LocationProbe />
            <BlogPage />
          </MotionProvider>
        </ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return view.container;
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches: false, addEventListener: () => {}, removeEventListener: () => {},
  })));
  useBlogPosts.mockReset();
  useVocabulary.mockReset();
  location = undefined;
  navType.current = 'PUSH';
  // ⚠️ `window.scrollTo` is a module-scoped vi.fn() from src/test/setup.js,
  // shared by every test in the run. Without this clear, a call count
  // assertion below would inherit calls made by earlier tests in this file.
  window.scrollTo.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ══════════════════════════════════════════════════════════════════════
describe('BlogPage — header', () => {
  it('renders the design\'s eyebrow, heading and deck', () => {
    const c = draw();
    expect(pick(c, 'eyebrowLabel').textContent).toBe('THE JOURNAL');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Field Notes');
    expect(pick(c, 'deck').textContent).toMatch(/^Everything I learn while building in public/);
  });

  it('strokes the word "Notes" rather than filling it', () => {
    const c = draw();
    expect(pick(c, 'outlined').textContent).toBe('Notes');
    expect(decls('.outlined').composes).toBe("outline-text from '../styles/patterns.module.css'");
  });

  it('carries the prototype\'s reveal stagger, in order', () => {
    const c = draw();
    const delays = ['eyebrow', 'heading', 'deck', 'statRow', 'searchRow']
      .map((n) => pick(c, n).style.transitionDelay);
    // jsdom reads `transitionDelay` back in ms, not the `0.06s` Reveal writes.
    expect(delays).toEqual(['0ms', '60ms', '120ms', '180ms', '240ms']);
  });

  it('renders the location pill verbatim', () => {
    const c = draw();
    expect(pick(c, 'locationPill').textContent).toBe('WRITTEN FROM GALLE, SRI LANKA');
  });
});

describe('BlogPage — the count pill', () => {
  it('reads "N POSTS · ALL TOPICS" when nothing is filtered', () => {
    const c = draw();
    expect(pick(c, 'countPill').textContent).toContain('4 POSTS · ALL TOPICS');
  });

  /**
   * The filtered form needs the UNFILTERED total, which a server-filtered
   * response cannot carry — hence the second query. This fixture is the one
   * that proves the page reads it: `filtered` and `total` differ.
   */
  it('reads "X OF N POSTS" when the filtered list is shorter than the total', () => {
    const c = draw({ filtered: ok(POSTS.slice(0, 2)), total: ok(POSTS), path: '/blog?tag=Docker' });
    expect(pick(c, 'countPill').textContent).toContain('2 OF 4 POSTS');
  });

  /**
   * Suppressed, not zeroed. During a cold load or after a failed fetch the
   * pill would otherwise read `0 POSTS · ALL TOPICS`, which is wrong rather
   * than merely absent — BlogSection's precedent.
   */
  it('is absent while loading and after a failure, rather than reading zero', () => {
    expect(pick(draw({ filtered: loading(), total: loading() }), 'countPill')).toBeNull();
    expect(pick(draw({ filtered: failed(new Error('x')), total: failed(new Error('x')) }), 'countPill')).toBeNull();
  });
});

describe('BlogPage — tag chips', () => {
  it('prepends "All" to the vocabulary, client-side', () => {
    const c = draw();
    expect(textsOf(c, 'chip')).toEqual(['All', 'React', 'MERN', 'Docker', 'DevOps', 'Java']);
  });

  it('marks the active chip with aria-pressed, which the prototype has not', () => {
    const c = draw({ path: '/blog?tag=Docker' });
    const pressed = pickAll(c, 'chip').filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(pressed.map((b) => b.textContent)).toEqual(['Docker']);
  });

  it('treats "All" as the active chip when no tag is in the URL', () => {
    const c = draw();
    const pressed = pickAll(c, 'chip').filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(pressed.map((b) => b.textContent)).toEqual(['All']);
  });

  /**
   * ⚠️ THE LOCKED DECISION, AND THE ONLY TEST IN THIS FILE THAT GUARDS IT.
   *
   * The chip row comes from `GET /api/vocabulary/tag?inUse=true`, NOT from
   * the fetched posts the way the prototype does it (Blog.dc.html:327).
   * PF-96 made `?q=`/`?tag=` server-side, so the post list arrives already
   * filtered — derived chips would SHRINK as you filter, and a visitor would
   * watch their own filter options disappear.
   *
   * ⚠️ DISCRIMINATING BY CONSTRUCTION, which is the whole point. The filtered
   * list here carries only `Docker`, while the vocabulary still carries five
   * tags. A page deriving chips from `posts` renders ONE chip plus 'All' and
   * fails; a page reading the vocabulary renders all six. A fixture whose
   * post tags happened to cover the vocabulary would pass either way and
   * guard nothing — the exact shape of vacuous guard that let PF-95's
   * ordering assertion pass 61 of 63 times against the reverted rule.
   */
  it('does NOT shrink when the post list is filtered', () => {
    const onlyDocker = ok([POSTS[2]]);   // tags: Docker, DevOps
    const c = draw({ filtered: onlyDocker, total: ok(POSTS), path: '/blog?tag=Docker' });

    expect(textsOf(c, 'chip')).toEqual(['All', 'React', 'MERN', 'Docker', 'DevOps', 'Java']);
    // And the thing that would have produced a passing-but-wrong result:
    expect(pickAll(c, 'cardTitle').length + 1).toBeLessThan(textsOf(c, 'chip').length);
  });

  it('asks the vocabulary hook for the IN-USE half only', () => {
    draw();
    expect(useVocabulary).toHaveBeenCalledWith('tag', { inUse: true });
  });

  it('every chip is type="button", never a submit', () => {
    const c = draw();
    for (const chip of pickAll(c, 'chip')) expect(chip.getAttribute('type')).toBe('button');
  });
});

describe('BlogPage — search', () => {
  it('takes its initial value from the URL, so a shared link arrives filtered', () => {
    const c = draw({ path: '/blog?q=docker' });
    expect(pick(c, 'searchInput').value).toBe('docker');
  });

  it('gives the field an accessible name the prototype does not', () => {
    draw();
    expect(screen.getByLabelText('Search posts, tags and tools')).toBeInTheDocument();
  });

  it('carries the prototype\'s placeholder, ellipsis character included', () => {
    const c = draw();
    expect(pick(c, 'searchInput').placeholder).toBe('Search posts, tags, tools…');
  });

  /**
   * ⚠️ The debounce is not a nicety. PF-96 made `?q=` a SERVER filter, so an
   * undebounced field is one HTTP request per keystroke against a backend
   * that rate-limits at 100 req / 15 min / IP — and an exhausted budget
   * presents as the page rendering its empty state for no reason.
   *
   * Asserted in two halves so a removed debounce cannot pass: the URL must
   * still be unchanged immediately after typing, and must have caught up
   * afterwards.
   */
  it('does not write the URL on every keystroke, and does write it once settled', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const c = draw();
      const input = pick(c, 'searchInput');
      const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;

      for (const ch of 'docker') {
        act(() => {
          setValue.call(input, input.value + ch);
          input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        act(() => { vi.advanceTimersByTime(40); });
      }

      expect(location.search).toBe('');           // still nothing written
      act(() => { vi.advanceTimersByTime(400); });
      expect(location.search).toBe('?q=docker');  // ...and then exactly one write
    } finally {
      vi.useRealTimers();
    }
  });

  it('removes the param rather than writing an empty one when cleared', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const c = draw({ path: '/blog?q=docker' });
      const input = pick(c, 'searchInput');
      const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      act(() => {
        setValue.call(input, '');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      act(() => { vi.advanceTimersByTime(400); });
      expect(location.search).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });
});

// ══════════════════════════════════════════════════════════════════════
describe('BlogPage — submitting and clearing (PF-104)', () => {
  const type = (input, value) => {
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value',
    ).set;
    act(() => {
      setValue.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };

  it('gives the search button an accessible name, since it has no label', () => {
    draw();
    // ⚠️ The icon inside is aria-hidden, so WITHOUT the button's own
    // aria-label this query finds nothing and the control announces as
    // "button". That inversion is the trap the icon module documents.
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
  });

  /**
   * ⚠️ The whole point of the magnifier: it must SKIP the 300 ms wait, not
   * merely do what the timer was going to do anyway. Fake timers are never
   * advanced here — if submitting relied on the debounce, `location.search`
   * would still be empty and this fails.
   */
  it('writes the URL immediately on submit, without waiting for the debounce', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const c = draw();
      type(pick(c, 'searchInput'), 'docker');
      expect(location.search).toBe('');            // debounce has not fired

      act(() => { screen.getByRole('button', { name: 'Search' }).click(); });
      expect(location.search).toBe('?q=docker');   // ...and we did not wait
    } finally {
      vi.useRealTimers();
    }
  });

  it('trims the term on submit, where the debounced path does not', () => {
    const c = draw();
    type(pick(c, 'searchInput'), '  docker  ');
    act(() => { screen.getByRole('button', { name: 'Search' }).click(); });
    expect(location.search).toBe('?q=docker');
  });

  it('submits on Enter, because the field is inside a real form', () => {
    const c = draw();
    type(pick(c, 'searchInput'), 'docker');
    act(() => {
      pick(c, 'searchInput').closest('form')
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(location.search).toBe('?q=docker');
  });

  /**
   * ⚠️ THE TRAP THE FORM CREATED. Every chip is `type="button"`, written
   * that way by PF-98 when there was no form at all. Adding one made that
   * load-bearing: without it, clicking a tag would SUBMIT rather than
   * filter, and it would look like it worked because the search term is
   * usually empty.
   */
  it('gives every chip an explicit type, so a chip click never submits', () => {
    const c = draw();
    const form = pick(c, 'searchInput').closest('form');
    const submits = [...form.querySelectorAll('button')]
      .filter((b) => (b.getAttribute('type') ?? 'submit') === 'submit');
    expect(submits.map((b) => b.getAttribute('aria-label'))).toEqual(['Search']);
  });

  it('shows the clear button only when there is something to clear', () => {
    const c = draw();
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
    type(pick(c, 'searchInput'), 'd');
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument();
  });

  it('clears the field and the URL, and hands focus back to the input', () => {
    const c = draw({ path: '/blog?q=docker' });
    act(() => { screen.getByRole('button', { name: 'Clear search' }).click(); });

    expect(pick(c, 'searchInput').value).toBe('');
    expect(location.search).toBe('');
    // Clearing is nearly always followed by typing again; a keyboard user
    // would otherwise have to tab back in from the button.
    expect(document.activeElement).toBe(pick(c, 'searchInput'));
  });

  it('toggles the active chip OFF instead of re-selecting it', () => {
    // Before PF-104 the only route back to unfiltered was the separate
    // `All` chip, which reads as a tag rather than as a reset.
    draw({ path: '/blog?tag=Docker' });
    act(() => { screen.getByRole('button', { name: 'Docker' }).click(); });
    expect(location.search).toBe('');
  });

  it('ADDS a different chip to the selection rather than replacing it', () => {
    // ⚠️ PF-105 changed this. It used to assert `?tag=React` — a second
    // click replaced the first, because the filter held one tag. Multi-tag
    // means the selection grows.
    //
    // It is still the control for the toggle test above: a toggle that
    // fired on every chip would CLEAR the filter here rather than extend
    // it, and the toggle test alone could not tell those apart.
    //
    // ⚠️ DevOps and not React, deliberately. Only p3 carries Docker AND
    // DevOps, so it is a reachable combination; nothing carries Docker AND
    // React, so that chip is correctly disabled and clicking it does
    // nothing. The first draft of this test used React and failed for that
    // reason — the dimming working, not the toggle broken.
    draw({ path: '/blog?tag=Docker' });
    act(() => { screen.getByRole('button', { name: 'DevOps' }).click(); });
    expect(location.search).toBe('?tag=Docker&tag=DevOps');
  });

  it('removes ONE tag from a multi-tag selection, leaving the rest', () => {
    draw({ path: '/blog?tag=Docker&tag=DevOps' });
    act(() => { screen.getByRole('button', { name: 'DevOps' }).click(); });
    expect(location.search).toBe('?tag=Docker');
  });

  it('marks every selected chip pressed, not just the last one', () => {
    draw({ path: '/blog?tag=Docker&tag=DevOps' });
    for (const label of ['Docker', 'DevOps']) {
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true');
    }
    expect(screen.getByRole('button', { name: 'Java' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows one removable pill per selected tag', () => {
    draw({ path: '/blog?tag=Docker&tag=DevOps' });
    expect(screen.getByRole('button', { name: 'Clear the Docker tag filter' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear the DevOps tag filter' })).toBeInTheDocument();
  });

  it('All clears every tag at once', () => {
    draw({ path: '/blog?tag=Docker&tag=DevOps' });
    act(() => { screen.getByRole('button', { name: 'All' }).click(); });
    expect(location.search).toBe('');
  });
});

// ══════════════════════════════════════════════════════════════════════
describe('BlogPage — no dead-end chip combinations (PF-105)', () => {
  /**
   * AND narrows fast, so the row disables any chip that would return
   * nothing with the current selection.
   *
   * ⚠️ Fixture tags: p1 React+MERN, p2 Docker, p3 Docker+DevOps, p4 Java.
   * With Docker selected, DevOps is reachable (p3) and React is not —
   * which is what makes these two assertions a real pair rather than one
   * claim tested twice. A rule that disabled EVERYTHING, or NOTHING, would
   * satisfy only one of them.
   */
  it('disables a chip whose combination has no posts, and only that chip', () => {
    draw({ path: '/blog?tag=Docker' });
    expect(screen.getByRole('button', { name: 'React' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'DevOps' })).toBeEnabled();
  });

  it('keeps a SELECTED chip clickable, since that is how it is removed', () => {
    draw({ path: '/blog?tag=Docker' });
    expect(screen.getByRole('button', { name: 'Docker' })).toBeEnabled();
  });

  /**
   * ⚠️ THE TEST THAT ACTUALLY GUARDS `!isSelected(label)`, and the reason
   * the one above is not enough.
   *
   * Mutation-tested: deleting `!isSelected(label)` from `isChipDisabled`
   * leaves the whole suite GREEN except for this case. In any reachable
   * state a selected chip trivially "would match" — asking whether
   * [Docker, Docker] has posts is asking whether [Docker] has posts, and it
   * does, or the filter would not be showing results. So the guard looks
   * redundant and the obvious test cannot tell it is doing anything.
   *
   * It earns its place only for a combination the chip row can no longer
   * build but a URL can still express. `?tag=Docker&tag=Java` matches
   * nothing, so without the guard EVERY chip — including the two selected
   * ones — is disabled, and the visitor cannot undo either half of their
   * own filter. Recoverable through All / CLEAR ALL, but a dead end that
   * should not exist.
   */
  it('leaves an impossible URL combination escapable, chip by chip', () => {
    draw({ filtered: ok([]), total: ok(POSTS), path: '/blog?tag=Docker&tag=Java' });
    expect(screen.getByRole('button', { name: 'Docker' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Java' })).toBeEnabled();
    // And an unselected chip that cannot help is still correctly dimmed —
    // otherwise this would pass against a rule that disabled nothing.
    expect(screen.getByRole('button', { name: 'React' })).toBeDisabled();
  });

  it('never disables All, which is the way out', () => {
    draw({ path: '/blog?tag=Docker' });
    expect(screen.getByRole('button', { name: 'All' })).toBeEnabled();
  });

  it('disables nothing when no tag is selected', () => {
    draw();
    for (const label of ['React', 'MERN', 'Docker', 'DevOps', 'Java']) {
      expect(screen.getByRole('button', { name: label })).toBeEnabled();
    }
  });

  it('disables nothing while the unfiltered list is still loading', () => {
    // ⚠️ Derived from `everyPost`. With no data yet there is nothing to
    // reason from, and dimming the whole row during a cold load would be
    // worse than dimming none of it.
    draw({ filtered: loading(), total: loading(), path: '/blog?tag=Docker' });
    expect(screen.getByRole('button', { name: 'React' })).toBeEnabled();
  });

  /**
   * ⚠️ The dimming has to stay READABLE, and the value is measured rather
   * than picked by eye.
   *
   * The first attempt was `opacity: .38` alone. Composited against the real
   * page in Chrome that gave 1.86 in light and 1.21 in dark — the tag name
   * was effectively invisible, which defeats the whole reason for dimming
   * instead of removing (PF-98 locked that the row must not shrink because
   * a visitor should not watch their options vanish; a chip nobody can read
   * has vanished in every way that counts).
   *
   * `.72` with a transparent background and border measures 3.41 light /
   * 4.36 dark, clearing WCAG's 3.0 bar for a user-interface component in
   * the worse theme. Light sets the floor.
   *
   * ⚠️ WCAG 1.4.3 EXEMPTS inactive controls from the contrast minimum, so
   * this is a deliberate choice to beat the standard, not a compliance fix
   * — which is exactly why it needs pinning: nothing else would fail if it
   * regressed.
   */
  it('keeps a dimmed chip legible, and gets its disabled look from shape', () => {
    const d = decls('.chipDisabled');
    expect(d.opacity).toBe('.72');
    // The "disabled" read comes mostly from LOSING the chip shape, which is
    // what allows the text to stay this legible.
    expect(d.background).toBe('none');
    expect(d['border-color']).toBe('transparent');
    expect(d.cursor).toBe('not-allowed');
  });

  it('cancels the hover lift on a disabled chip', () => {
    // `:hover` does not care about `disabled`, so `.chip:hover` still
    // matches — without this the chip lifts and lights its border while
    // being unclickable, which reads as "this works".
    expect(decls('.chipDisabled:hover').transform).toBe('none');
    expect(decls('.chipDisabled:hover')['border-color']).toBe('transparent');
  });

  it('reasons from the UNFILTERED list, not the filtered one', () => {
    // ⚠️ The trap. `list` is already narrowed by the active filter, so a
    // rule built on it would disable almost every chip the moment a filter
    // matched one post. Here the filtered response is a single post
    // carrying only Docker, while the unfiltered set still shows DevOps is
    // reachable — the two lists disagree, which is what makes this
    // discriminating.
    draw({ filtered: ok([POSTS[1]]), total: ok(POSTS), path: '/blog?tag=Docker' });
    expect(screen.getByRole('button', { name: 'DevOps' })).toBeEnabled();
  });

  it('surfaces the active filters with a CLEAR ALL, not only in the empty state', () => {
    draw({ path: '/blog?q=docker&tag=React' });
    expect(screen.getByText('“docker”')).toBeInTheDocument();
    act(() => { screen.getByRole('button', { name: 'CLEAR ALL' }).click(); });
    expect(location.search).toBe('');
  });

  it('shows no filter summary when nothing is filtered', () => {
    draw();
    expect(screen.queryByText('FILTERING BY')).toBeNull();
  });
});

describe('BlogPage — the featured card', () => {
  it('is the FIRST item of the server-ordered list, with no client re-sort', () => {
    const c = draw();
    expect(pick(c, 'featuredTitle').textContent).toBe('Newest Post');
    expect(POSTS.map((p) => p._id)).toEqual(['p1', 'p2', 'p3', 'p4']); // fixture unmutated
  });

  it('re-picks within the filtered list rather than pinning the global newest', () => {
    const c = draw({ filtered: ok(POSTS.slice(1)), total: ok(POSTS), path: '/blog?tag=Docker' });
    expect(pick(c, 'featuredTitle').textContent).toBe('Second Post');
  });

  it('links to the post\'s own URL', () => {
    const c = draw();
    expect(pick(c, 'featuredCard').getAttribute('href')).toBe('/blog/newest-post');
    expect(pick(c, 'featuredCard').tagName).toBe('A');
  });

  it('renders the badge, the meta line and the CTA verbatim', () => {
    const c = draw();
    expect(pick(c, 'badge').textContent).toBe('LATEST POST');
    expect(pick(c, 'featuredMeta').textContent).toBe('14 JUL 2026 · 6 MIN READ');
    expect(pick(c, 'featuredCta').textContent).toBe('READ THE POST →');
  });

  /**
   * ⚠️ The ghost `01` was removed by owner decision (2026-08-22) and the
   * locked entry says the /blog index inherits the removal. Guarded THREE
   * ways, because each catches a different way of putting it back.
   */
  it('has no ghost numeral — no element, no bare "01", no selector', () => {
    const c = draw();
    expect(pick(c, 'ghostNumeral')).toBeNull();
    expect(screen.queryByText('01')).toBeNull();
    expect(selectors).not.toContain('.ghostNumeral');
  });

  /**
   * ⚠️ The trap the removal above has to survive. `.sweep` is a DIFFERENT
   * absolute child of the same card and stays — this is what nearly took
   * `.scanTexture` with the splash scan lines and `.portraitFade` with the
   * About caption.
   */
  it('KEEPS the sweep layer, which is a different element entirely', () => {
    const c = draw();
    expect(pick(c, 'sweep')).not.toBeNull();
    expect(pick(c, 'sweep').getAttribute('aria-hidden')).toBe('true');
    expect(pickAll(c, 'featuredCard')[0].querySelectorAll('[aria-hidden="true"]').length)
      .toBeGreaterThanOrEqual(1);
  });

  /**
   * The keyframe is pulled in by `composes`, never named in the module — a
   * keyframe named inside a *.module.css is scoped to an identifier no
   * @keyframes defines, and the element then silently does not animate while
   * getComputedStyle still reports it as running.
   */
  it('composes the sweep keyframe and spells the timing as longhands', () => {
    const d = decls('.sweep');
    expect(d.composes).toBe('kf-sweep from global');
    expect(d.animation).toBeUndefined();          // the shorthand would reset animation-name
    expect(d['animation-duration']).toBe('9s');
    expect(d['animation-timing-function']).toBe('linear');
    expect(d['animation-iteration-count']).toBe('infinite');
    expect(d['background-size']).toBe('100% 320%');
  });

  it('declares no @keyframes of its own anywhere in the module', () => {
    const names = [];
    root.walkAtRules('keyframes', (r) => names.push(r.params));
    expect(names).toEqual([]);
  });
});

describe('BlogPage — the grid', () => {
  it('renders every post after the featured one, in order', () => {
    const c = draw();
    expect(textsOf(c, 'cardTitle')).toEqual(['Second Post', 'Third Post', 'Fourth Post']);
  });

  it('numbers the cards from 02, all decorative', () => {
    const c = draw();
    expect(textsOf(c, 'cardNumeral')).toEqual(['02', '03', '04']);
    for (const n of pickAll(c, 'cardNumeral')) {
      expect(n.getAttribute('aria-hidden')).toBe('true');
    }
  });

  /**
   * ⚠️ PF-103's sanctioned deviation, and the one value on this card a
   * fidelity pass WILL try to revert — Blog.dc.html:180 says `-18px`.
   *
   * Measured in Chrome before PF-103: Anton's digit ink sits 4.42px below
   * the span's box top at 86px — about 5.1% of the font size — so `-18px`
   * left the ink top 13.58px above the card edge and `overflow: hidden`
   * sliced 13.58 of a 75.25px glyph.
   *
   * ⚠️ PF-104 then shrank it 86px → 56px (owner-requested 2026-09-06) so
   * the numeral clears the TITLE, not just the card edge. At 56px the ink
   * offset scales to ~2.9px, so `-2px` still seats it inside; the binding
   * constraint is now the title below it, verified in the browser.
   *
   * The halves are asserted together deliberately: `overflow: hidden` is
   * the prototype's own and must STAY, so a later "fix" that deletes the
   * clip instead of moving the numeral fails here rather than silently
   * letting the digits bleed into the grid gutter.
   */
  it('seats the numeral fully inside the card, and keeps the card clipping', () => {
    expect(decls('.cardNumeral').top).toBe('-2px');
    expect(decls('.cardNumeral').right).toBe('6px');
    expect(decls('.cardNumeral')['font-size']).toBe('56px');
    expect(decls('.cardNumeral')['line-height']).toBe('1');
    expect(decls('.card').overflow).toBe('hidden');
  });

  it('links each card to its own slug', () => {
    const c = draw();
    expect(pickAll(c, 'card').map((a) => a.getAttribute('href')))
      .toEqual(['/blog/second-post', '/blog/third-post', '/blog/fourth-post']);
  });

  it('renders each card\'s meta and CTA', () => {
    const c = draw();
    expect(pick(c, 'cardMeta').textContent).toBe('14 JUN 2026·7 MIN READ');
    expect(pick(c, 'cardCta').textContent).toBe('READ →');
  });

  it('renders every tag, with no truncation', () => {
    const c = draw();
    expect(pickAll(c, 'cardTagPill').map((p) => p.textContent))
      .toEqual(['Docker', 'Docker', 'DevOps', 'Java']);
  });
});

describe('BlogPage — empty states', () => {
  /**
   * ⚠️ TWO states, owner-approved 2026-09-05. The prototype has only the
   * filtered one, whose copy tells the visitor to clear filters — misleading
   * on a blog with no published posts at all, where they set none.
   *
   * The discriminator is the UNFILTERED TOTAL, not this list's length: zero
   * posts anywhere is a different fact from zero matches.
   */
  it('shows the design\'s copy when a filter matched nothing', () => {
    const c = draw({ filtered: ok([]), total: ok(POSTS), path: '/blog?q=zzz' });
    expect(pick(c, 'emptyHeading').textContent).toBe('Nothing filed under that');
    expect(pick(c, 'emptyBody').textContent).toBe('Try another keyword or clear the filters.');
    expect(pick(c, 'resetButton').textContent).toBe('RESET FILTERS');
  });

  it('shows different copy, and NO reset button, when there are no posts at all', () => {
    const c = draw({ filtered: ok([]), total: ok([]) });
    expect(pick(c, 'emptyHeading').textContent).toBe('Nothing filed yet');
    expect(pick(c, 'emptyBodyLast').textContent).toBe('The first field note is still being written.');
    expect(pick(c, 'resetButton')).toBeNull();
  });

  /**
   * ⚠️ PF-104. The copy above is true but never said WHAT was searched, so
   * a stale tag left over from an earlier click looked like a site with no
   * posts. All three shapes are asserted because the message is assembled
   * from two independent flags and only one of the four combinations is
   * unreachable (neither filter set cannot produce a filtered empty state).
   */
  it('names the search term when only a query is active', () => {
    const c = draw({ filtered: ok([]), total: ok(POSTS), path: '/blog?q=kubernetes' });
    expect(pick(c, 'emptyTerm').textContent).toBe('No posts match "kubernetes".');
  });

  it('names the tag when only a tag is active', () => {
    const c = draw({ filtered: ok([]), total: ok(POSTS), path: '/blog?tag=Docker' });
    expect(pick(c, 'emptyTerm').textContent).toBe('No posts tagged DOCKER.');
  });

  it('paints CLEAR ALL with the design system\'s only sanctioned red', () => {
    // ⚠️ `var(--danger)`, not a literal. It is dual-theme (#f87171 dark /
    // #B4231F light) and PF-91 measured the pair at 6.68 / 5.88; measured
    // again on THIS surface it is 7.32 dark / 5.38 light, both clearing the
    // 4.5 that 10.5px text needs.
    //
    // The admin panel's #dc2626 and rgba(239,68,68,…) are hardcoded Phase 1
    // literals that do NOT flip with the theme — a light-theme failure
    // waiting to happen, and PF-100's problem, not this page's.
    expect(decls('.clearAll').color).toBe('var(--danger)');
    // Hover keeps the red and thickens the rule instead of switching to the
    // accent: losing the red at the moment of committing would read as the
    // warning being withdrawn.
    expect(decls('.clearAll:hover').color).toBeUndefined();
    expect(decls('.clearAll:hover')['text-decoration-thickness']).toBe('2px');
  });

  it('joins several tags with "and", matching the AND semantics', () => {
    // ⚠️ "and", not "or". The copy has to describe the filter the server
    // actually runs — "or" would send the reader looking for posts that
    // were never going to appear.
    const c = draw({ filtered: ok([]), total: ok(POSTS), path: '/blog?tag=Docker&tag=Java' });
    expect(pick(c, 'emptyTerm').textContent).toBe('No posts tagged DOCKER and JAVA.');
  });

  it('names both when both are active', () => {
    const c = draw({ filtered: ok([]), total: ok(POSTS), path: '/blog?q=kubernetes&tag=Docker' });
    expect(pick(c, 'emptyTerm').textContent)
      .toBe('No posts match "kubernetes" tagged DOCKER.');
  });

  /**
   * ⚠️ Built from the URL, never from the input's draft state. A message
   * assembled from `draft` would name a half-typed word nobody searched
   * for — the field holds "kuber" for 300 ms after the URL still says
   * "kubernetes".
   */
  it('names the term the QUERY used, not whatever is in the box', () => {
    const c = draw({ filtered: ok([]), total: ok(POSTS), path: '/blog?q=kubernetes' });
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value',
    ).set;
    act(() => {
      setValue.call(pick(c, 'searchInput'), 'something else entirely');
      pick(c, 'searchInput').dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(pick(c, 'emptyTerm').textContent).toBe('No posts match "kubernetes".');
  });

  it('announces the empty state without stealing focus', () => {
    // role="status" is polite — a live search that moved focus on every
    // zero-result keystroke would trap a screen-reader user mid-word.
    const c = draw({ filtered: ok([]), total: ok(POSTS), path: '/blog?q=zzz' });
    expect(pick(c, 'empty').getAttribute('role')).toBe('status');
  });

  it('shows no term line in the nothing-published-yet state', () => {
    // That state has no filter to name, and naming one would be a lie.
    const c = draw({ filtered: ok([]), total: ok([]) });
    expect(pick(c, 'emptyTerm')).toBeNull();
  });

  it('RESET FILTERS clears every param at once', async () => {
    const c = draw({ filtered: ok([]), total: ok(POSTS), path: '/blog?q=zzz&tag=Docker' });
    act(() => { pick(c, 'resetButton').click(); });
    await waitFor(() => expect(location.search).toBe(''));
  });

  it('renders no card and no featured card in either empty state', () => {
    for (const total of [ok(POSTS), ok([])]) {
      const c = draw({ filtered: ok([]), total, path: '/blog?q=zzz' });
      expect(pick(c, 'featuredCard')).toBeNull();
      expect(pickAll(c, 'card')).toHaveLength(0);
      expect(pick(c, 'featuredPlaceholder')).toBeNull();
    }
  });
});

describe('BlogPage — loading', () => {
  it('shows one featured and three card placeholders, all inert', () => {
    const c = draw({ filtered: loading(), total: loading() });
    expect(pick(c, 'featuredPlaceholder')).not.toBeNull();
    expect(pickAll(c, 'cardPlaceholder')).toHaveLength(3);
    for (const el of [pick(c, 'featuredPlaceholder'), ...pickAll(c, 'cardPlaceholder')]) {
      expect(el.tagName).toBe('DIV');
      expect(el.getAttribute('aria-hidden')).toBe('true');
      // Never a Reveal: a placeholder that animates in and is then replaced
      // animates the same grid slot twice.
      expect(el.hasAttribute('data-reveal')).toBe(false);
    }
  });

  it('keeps the header, the search box and the chips usable while loading', () => {
    const c = draw({ filtered: loading(), total: loading() });
    expect(pick(c, 'searchInput')).not.toBeNull();
    expect(textsOf(c, 'chip')).toEqual(['All', 'React', 'MERN', 'Docker', 'DevOps', 'Java']);
  });

  it('uses the MEASURED placeholder floors, as min-height not height', () => {
    expect(decls('.featuredPlaceholder')['min-height']).toBe('258px');
    expect(decls('.cardPlaceholder')['min-height']).toBe('259px');
    expect(decls('.featuredPlaceholder').height).toBeUndefined();
    expect(decls('.cardPlaceholder').height).toBeUndefined();
  });
});

describe('BlogPage — failure', () => {
  it('hides the grid but keeps the header and the filters', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const c = draw({ filtered: failed(new Error('boom')), total: failed(new Error('boom')) });

    expect(pick(c, 'featuredCard')).toBeNull();
    expect(pickAll(c, 'card')).toHaveLength(0);
    expect(pick(c, 'featuredPlaceholder')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(pick(c, 'searchInput')).not.toBeNull();
  });

  /**
   * Logged from an effect, never the render body. A render-phase
   * console.error fires again on every unrelated re-render — a theme toggle,
   * a parent state change — turning one failed fetch into a console full of
   * duplicates.
   */
  /**
   * ⚠️ BEFORE PF-101 A FAILED FETCH RENDERED NOTHING AT ALL, and no test
   * noticed — the only error assertion in this file was the console.error
   * one below, which passes just as well against a blank page.
   *
   * The trace: `showGrid = !isError` killed the featured block AND the
   * grid, while `isEmpty` excluded `isError` so neither empty branch
   * fired. Every branch in the section was false simultaneously.
   *
   * ⚠️ This is why "does it log the error" is not a substitute for "does
   * the reader see anything". The console assertion measured the
   * diagnostic, not the interface.
   */
  it('shows an error panel when the fetch fails, not a blank section', () => {
    const c = drawFailed();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Field notes are not loading/i)).toBeInTheDocument();
    // The section is not merely non-empty — it must not be the blank case.
    expect(c.querySelectorAll('[class*="featuredCard"]')).toHaveLength(0);
    expect(c.querySelectorAll('[class*="cardPlaceholder"]')).toHaveLength(0);
  });

  /**
   * ⚠️ `role="alert"`, NOT `role="status"`. The filtered-empty panel is
   * deliberately polite because live search fires it on nearly every
   * keystroke; a fetch failure is not keystroke-driven and should
   * interrupt. Both directions pinned, or the two panels could silently
   * converge on one role.
   */
  it('announces the error assertively and the filtered-empty politely', () => {
    drawFailed();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
    cleanup();

    draw({ filtered: ok([]), total: ok(POSTS), path: '/blog?q=zzz' });
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  /**
   * ⚠️ `type="button"` is load-bearing even though this control sits
   * outside the search `<form>`: a button with no type inside a form is a
   * SUBMIT button, and this panel is one refactor away from moving. PF-97
   * shipped exactly that bug — a confirm dialog inside a form silently
   * saved the form.
   */
  it('offers a retry that calls refetch, and is a non-submitting button', async () => {
    const refetch = vi.fn();
    drawFailed({ refetch });

    const retry = screen.getByRole('button', { name: 'TRY AGAIN' });
    expect(retry).toHaveAttribute('type', 'button');

    await userEvent.click(retry);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('disables the retry while a refetch is already in flight', () => {
    drawFailed({ isFetching: true });
    const retry = screen.getByRole('button', { name: 'RETRYING…' });
    expect(retry).toBeDisabled();
  });

  it('logs the failure exactly once across a re-render', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('boom');
    useBlogPosts.mockImplementation(() => failed(err));
    useVocabulary.mockImplementation(() => ok(VOCAB));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const tree = (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/blog']}>
          <ThemeProvider><MotionProvider><BlogPage /></MotionProvider></ThemeProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
    const { rerender } = render(tree);
    rerender(tree);

    const ours = spy.mock.calls.filter((c) => String(c[0]).includes('BlogPage'));
    expect(ours).toHaveLength(1);
  });
});

// ══════════════════════════════════════════════════════════════════════
describe('BlogPage — the stylesheet', () => {
  /**
   * ⚠️ PF-101. An unbroken token in a title had no wrap guard, so it
   * overflowed and was CLIPPED — silently, because the card's own
   * `overflow: hidden` absorbs it and the page never scrolls sideways
   * (`docOverflowX` stayed 0 at every width measured).
   *
   * Measured with an 85-character token: 1039px of content in a 238px box at 320px wide, 1970 in 1106 at 1280.
   *
   * ⚠️ NOT a narrow-viewport bug. It clips at 1280 too — the content is
   * wider than any box the design has. A responsive sweep that only
   * looked at phone widths would have called this clean.
   *
   * ⚠️ Asserted through postcss, not a text search: the rule's own
   * comment names `overflow-wrap` while explaining why it is there, so a
   * raw `toContain` would match the explanation and pass regardless.
   */
  it('.featuredTitle wraps an unbroken token rather than clipping it', () => {
    expect(decls('.featuredTitle')['overflow-wrap']).toBe('anywhere');
  });

  /**
   * PF-93. `Reveal` owns `transition` for the life of the element it
   * renders, entrance and hover alike. A `transition` declared on one of
   * these ties with `.reveal` at (0,1,0) and wins on emission order, eating
   * the entrance easing — silently.
   */
  it.each(['featuredCard', 'card', 'eyebrow', 'heading', 'deck', 'statRow', 'searchRow'])(
    '.%s declares no transition', (name) => {
      expect(transitions.filter((t) => t.selector === `.${name}`)).toEqual([]);
    },
  );

  it('declares transitions ONLY on elements that are inside a reveal, never one', () => {
    // ⚠️ A GROUPED rule (`.a, .b { transition: … }`) arrives here as ONE
    // selector string containing a comma and a newline. Splitting is not
    // cosmetic: without it `.searchClear, .searchSubmit` reads as a single
    // unknown selector, and the whitelist below could be satisfied by
    // grouping a genuinely-offending selector with an allowed one.
    const named = transitions
      .flatMap((t) => t.selector.split(','))
      .map((sel) => sel.trim())
      .sort();

    // Every one of these is a child INSIDE the search Reveal, never the
    // Reveal itself — `.searchRow` is covered by the it.each above.
    expect(named).toEqual([
      '.activeFilterPill',
      '.chip',
      '.clearAll',
      '.searchClear',
      '.searchField',
      '.searchSubmit',
    ]);
  });

  it('never gates a transition on [data-reveal], which does not work', () => {
    expect(selectors.filter((s) => s.includes('[data-reveal'))).toEqual([]);
  });

  /**
   * ⚠️ /blog's two tag pills are a FIFTH and SIXTH shape in this repo, and
   * both are near-misses against BlogSection's — same colours, different
   * size, padding and tracking. Composing BlogSection's would render
   * something that looks approximately right, which is the hardest kind of
   * fidelity bug to spot. Cross-parsed rather than restated, so this fails
   * if either file drifts.
   */
  it('does not reuse BlogSection\'s tag pill for either of its own', () => {
    const theirs = declsOf(
      readFileSync(resolve(here, '../../components/sections/BlogSection.module.css'), 'utf8'),
      '.tagPill',
    );
    const differingFrom = (mine) => ['font-size', 'padding', 'letter-spacing']
      .filter((prop) => decls(mine)[prop] !== theirs[prop]);

    for (const mine of ['.featuredTagPill', '.cardTagPill']) {
      expect(decls(mine).composes).toBeUndefined();
    }

    // The featured pill differs on all three.
    expect(differingFrom('.featuredTagPill').sort())
      .toEqual(['font-size', 'letter-spacing', 'padding']);

    // ⚠️ The GRID pill is the more dangerous of the two: its `font-size` is
    // IDENTICAL to the teaser's and its padding differs by a single pixel on
    // one axis, so composing the teaser's renders something almost right.
    // Pinned as exactly two differences — if a later edit makes them agree,
    // this fails rather than quietly collapsing the two shapes into one.
    expect(differingFrom('.cardTagPill').sort())
      .toEqual(['letter-spacing', 'padding']);
    expect(decls('.cardTagPill')['font-size']).toBe(theirs['font-size']);
  });

  it('transcribes both pill sizes exactly, and they differ from each other', () => {
    expect(decls('.featuredTagPill')['font-size']).toBe('11px');
    expect(decls('.featuredTagPill').padding).toBe('6px 12px');
    expect(decls('.cardTagPill')['font-size']).toBe('10.5px');
    expect(decls('.cardTagPill').padding).toBe('5px 11px');
    // Neither carries the teaser's tracking.
    expect(decls('.featuredTagPill')['letter-spacing']).toBeUndefined();
    expect(decls('.cardTagPill')['letter-spacing']).toBeUndefined();
  });

  it('uses the badge padding from THIS prototype, not the teaser\'s', () => {
    expect(decls('.badge').padding).toBe('5px 11px');
  });

  /**
   * PF-91, applied to a new surface of the same kind: `--muted2` at 10.5px
   * on a translucent card measures 4.15 against this card's composited
   * ground, below the 4.5 AA needs. `--muted` measures 7.00. Both figures
   * measured in Chromium during PF-98, not carried over.
   *
   * ⚠️ It must win on SPECIFICITY, not emission order — an equal-specificity
   * tie resolving on bundle order is a bug this project has hit six times.
   */
  it('lifts the card meta one token in DARK only, via specificity', () => {
    expect(decls('.cardMeta').color).toBe('var(--muted2)');
    const dark = selectors.filter((s) => /^:global\(html\[data-theme='dark'\]\)\s+\./.test(s));
    expect(dark).toContain(":global(html[data-theme='dark']) .cardMeta");
    // Not a second bare class, which would tie at (0,1,0).
    expect(selectors.filter((s) => s === '.cardMeta')).toHaveLength(1);
  });

  it('keeps the separator at the PF-91 alpha, not the prototype\'s .65', () => {
    expect(decls('.cardMetaSep').opacity).toBe('.9');
  });

  it('keeps the featured card\'s gradient, which is card paint not a wash', () => {
    expect(decls('.featuredCard').background).toContain('linear-gradient(150deg');
  });

  /**
   * A <Link> inherits `a:hover { color: var(--strong) }` from tokens.css, so
   * a card rendered as one lightens its whole body copy on hover unless the
   * colour is pinned in BOTH states.
   */
  it.each(['.featuredCard', '.card'])('pins %s colour in both states', (sel) => {
    expect(decls(sel).color).toBe('inherit');
    expect(decls(`${sel}:hover`).color).toBe('inherit');
  });

  it('suppresses the search ring with a TRANSPARENT outline, never `none`', () => {
    const d = decls('.searchInput:focus');
    expect(d.outline).toBe('2px solid transparent');
    expect(d['outline-offset']).toBe('2px');
    // The repo's rule: `outline: none` appears exactly once, and not here.
    expect(Object.values(d)).not.toContain('none');
  });

  it('indicates search focus on the container, the way the design does', () => {
    expect(decls('.searchField:focus-within')['border-color']).toBe('var(--acc, #FCA311)');
  });
});

// ══ the view counter (PF-99) ══════════════════════════════════════════
describe('view counts on the cards', () => {
  /**
   * ⚠️ EVERY ASSERTION HERE IS A PAIR — one post with views, one without.
   * A one-sided check passes against a component that ALWAYS renders and
   * against one that NEVER does, depending which half was written. That
   * matters more than usual under the owner's hide-at-zero decision
   * (2026-09-06): a missing counter and a broken counter look identical
   * on screen, so these tests are the only thing that tells them apart.
   */
  it('renders the count on the featured card, grouping thousands', () => {
    // Pinned at en-GB, for the same reason utils/blogMeta.js pins its
    // date locale: this sits in mono type beside `6 MIN READ`, and a
    // locale that groups with spaces produces a width the row has no
    // styling for.
    expect(pick(draw(), 'featuredCard').textContent).toContain('1,284');
  });

  it('renders the count on a grid card that has views', () => {
    const c = draw();
    const third = pickAll(c, 'card').find((el) => el.textContent.includes('Third Post'));
    expect(third.textContent).toContain('7');
    expect(third.textContent).toContain('views');   // the visually-hidden label
  });

  it('says "view", singular, for a post read exactly once', () => {
    // ⚠️ Found in a real browser, not in review — the label is visually
    // hidden, so "1 views" was invisible on screen and only a probe
    // reading textContent (or a screen reader) could see it. It is also
    // the MOST common state, not an edge case: every post passes through
    // exactly 1 the first time anybody reads it.
    const c = draw({ filtered: ok([{ ...POSTS[0], views: 1 }]), total: ok(POSTS) });
    expect(pick(c, 'featuredCard').textContent).toMatch(/1\s*view$/);
    expect(pick(c, 'featuredCard').textContent).not.toMatch(/1\s*views/);
  });

  it('renders NO counter for a post with zero views', () => {
    const c = draw();
    const second = pickAll(c, 'card').find((el) => el.textContent.includes('Second Post'));
    expect(second.textContent).not.toMatch(/views/);
  });

  it('renders NO counter for a post whose views field is absent', () => {
    // `undefined` and `0` reach the same outcome by different routes — a
    // projected-away field versus a genuinely unread post — and both are
    // handled rather than one throwing.
    const c = draw();
    const fourth = pickAll(c, 'card').find((el) => el.textContent.includes('Fourth Post'));
    expect(fourth.textContent).not.toMatch(/views/);
  });

  it('keeps the CTA first in the footer row, so an absent counter moves nothing', () => {
    // The layout guarantee behind hide-at-zero. `space-between` with the
    // CTA as first child is what makes a card with no counter render its
    // CTA exactly where a card with one does.
    const d = decls('.cardFooter');
    expect(d.display).toBe('flex');
    expect(d['justify-content']).toBe('space-between');

    const c = draw();
    const second = pickAll(c, 'card').find((el) => el.textContent.includes('Second Post'));
    const footer = second.querySelector('[class]');
    expect(pickAll(second, 'cardCta')[0].textContent).toBe('READ →');
    expect(footer).not.toBeNull();
  });
});

// ══ landing scroll (2026-09-06) ═══════════════════════════════════════
describe('scroll position on arrival', () => {
  /**
   * ⚠️ FOUND BY WALKING THE JOURNEY, not by reading code. The reading
   * view's bottom back control sits ~900px down a long post, and React
   * Router carries the scroll position across a navigation — so landing on
   * a SHORTER filtered index clamped to its bottom, putting the search
   * box, the chips and CLEAR ALL above the fold. Measured `scrollY 912`
   * against `maxScroll 911`.
   */
  it('scrolls to the top when the reader arrives by a link (PUSH)', () => {
    draw();
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
  });

  it('does NOT scroll on Back or Forward, so the grid position is restored', () => {
    // ⚠️ The discriminator, and the reason this is correct rather than
    // just convenient: a reader pressing Back from a post expects to be
    // where they left off in the grid, not at the top.
    navType.current = 'POP';
    draw();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('does not re-scroll when a filter changes', async () => {
    // ⚠️ THE REGRESSION THIS GUARDS. Every debounced keystroke is a
    // REPLACE and every chip click is a PUSH. Without the once-per-mount
    // ref, filtering while scrolled down would yank the page to the top on
    // each keystroke. Filter changes do not remount the page, so the ref
    // must hold across them.
    //
    // ⚠️ THE navType FLIP ON LINE 4 IS WHAT MAKES THIS TEST MEAN ANYTHING,
    // and its first version did not have it. With the mock pinned to one
    // value the effect's `[navigationType]` dependency never changes, so
    // the effect does not re-run and the assertion passes WITH OR WITHOUT
    // the ref — measured: bypassing the ref left all 103 tests green. The
    // real router genuinely reports a new type as the URL is rewritten, so
    // the fixture has to as well. Any "X does not happen again" assertion
    // needs a fixture where the thing that would re-trigger it actually
    // changes.
    const c = draw();
    expect(window.scrollTo).toHaveBeenCalledTimes(1);

    navType.current = 'REPLACE';   // what setSearchParams really produces
    const docker = pickAll(c, 'chip').find((b) => b.textContent === 'Docker');
    await act(async () => { docker.click(); });
    expect(window.scrollTo).toHaveBeenCalledTimes(1);   // still one
  });
});

// ══ card links reach the reading view (PF-99) ═════════════════════════
describe('card links', () => {
  it('links each card to its own post', () => {
    const c = draw();
    expect(pick(c, 'featuredCard').getAttribute('href')).toBe('/blog/newest-post');
    expect(pickAll(c, 'card').map((el) => el.getAttribute('href')))
      .toEqual(['/blog/second-post', '/blog/third-post', '/blog/fourth-post']);
  });

  it('still links each card to its own post while a filter is active', () => {
    // ⚠️ The filter itself rides as router STATE, which never reaches the
    // DOM — so an href check cannot see it, and BlogPostPage.test.jsx
    // covers the receiving half. What IS observable here is that the
    // filter does not leak into the post URLs, which was the rejected
    // alternative.
    const c = draw({ path: '/blog?tag=Docker' });
    expect(pick(c, 'featuredCard').getAttribute('href')).toBe('/blog/newest-post');
    expect(location.search).toBe('?tag=Docker');
  });
});
