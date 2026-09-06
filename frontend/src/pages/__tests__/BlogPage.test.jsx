// frontend/src/pages/__tests__/BlogPage.test.jsx
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { render, screen, waitFor, act } from '@testing-library/react';
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
const POSTS = Object.freeze([
  Object.freeze({ _id: 'p1', title: 'Newest Post', slug: 'newest-post',
    excerpt: 'The most recent one.', tags: Object.freeze(['React', 'MERN']),
    readingTimeMinutes: 6, publishedAt: '2026-07-14T09:00:00.000Z' }),
  Object.freeze({ _id: 'p2', title: 'Second Post', slug: 'second-post',
    excerpt: 'The second one.', tags: Object.freeze(['Docker']),
    readingTimeMinutes: 7, publishedAt: '2026-06-14T09:00:00.000Z' }),
  Object.freeze({ _id: 'p3', title: 'Third Post', slug: 'third-post',
    excerpt: 'The third one.', tags: Object.freeze(['Docker', 'DevOps']),
    readingTimeMinutes: 4, publishedAt: '2026-05-14T09:00:00.000Z' }),
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
    expect(pick(c, 'featuredMeta').textContent).toBe('JUL 2026 · 6 MIN READ');
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
   * Measured in Chrome before the change: Anton at 86px puts the digit ink
   * 4.42px below the span's box top, so `-18px` left the ink top 13.58px
   * above the card edge and `overflow: hidden` sliced 13.58 of a 75.25px
   * glyph. `-2px` puts the ink 2.42px inside the card.
   *
   * The two halves are asserted together deliberately: `overflow: hidden` is
   * the prototype's own and must STAY, so a later "fix" that deletes the
   * clip instead of moving the numeral fails here rather than silently
   * letting the digits bleed into the grid gutter.
   */
  it('seats the numeral fully inside the card, and keeps the card clipping', () => {
    expect(decls('.cardNumeral').top).toBe('-2px');
    expect(decls('.cardNumeral').right).toBe('6px');
    expect(decls('.cardNumeral')['font-size']).toBe('86px');
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
    expect(pick(c, 'cardMeta').textContent).toBe('JUN 2026·7 MIN READ');
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
    expect(transitions.map((t) => t.selector).sort())
      .toEqual(['.chip', '.searchField']);
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
