// frontend/src/pages/__tests__/BlogPostPage.test.jsx
//
// PF-99 — the /blog/:slug reading view.
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import postcss from 'postcss';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../providers/ThemeProvider';
import { MotionProvider } from '../../providers/MotionProvider';

// vi.mock, not vi.spyOn on the module namespace — Vite's SSR transform
// defines each export as a getter-only property, so spyOn cannot redefine it.
const useBlogPost   = vi.hoisted(() => vi.fn());
const recordViewFn  = vi.hoisted(() => vi.fn());
const useRecordView = vi.hoisted(() => vi.fn());
vi.mock('../../hooks/useBlog', () => ({ useBlogPost, useRecordView }));

const { BlogPostPage } = await import('../BlogPostPage');

const here = dirname(fileURLToPath(import.meta.url));
const css  = readFileSync(resolve(here, '../BlogPostPage.module.css'), 'utf8');

/**
 * ⚠️ Every CSS assertion goes through postcss, never a regex over the raw
 * text. This module documents the REMOVED "GOT A QUESTION / EMAIL ME"
 * panel and the resulting 44px → 38px gap IN PROSE, right where the rule
 * would have been — so a `not.toContain('44px')` would match the comment
 * explaining the removal and pass while proving nothing. Five guards in
 * this repo were blind on first write for exactly that reason. Parsing is
 * immune rather than defended: a comment is a node type a declaration
 * walk never visits.
 */
const root = postcss.parse(css);

function decls(selector) {
  let found = null;
  root.walkRules((rule) => {
    if (rule.selector === selector) {
      found = {};
      rule.walkDecls((d) => { found[d.prop] = d.value; });
    }
  });
  if (!found) throw new Error(`no rule for "${selector}"`);
  return found;
}

const selectors = (() => {
  const out = [];
  root.walkRules((rule) => out.push(...rule.selectors));
  return out;
})();

// ── DOM lookup by CSS-Module local name, matched EXACTLY ──────────────
// `[class*="nav"]` would also match navCard, navPrev, navNext, navLabel
// and navTitle; every one of those collisions reads as a component bug
// rather than a selector bug.
function localName(token) {
  const scoped = /^_(.+)_[^_]+$/.exec(token);   // Vitest:   _navCard_f5cf21
  if (scoped) return scoped[1];
  const named = /__(.+)$/.exec(token);          // Vite dev: File-module__navCard
  return named ? named[1] : token;
}
const has     = (el, name) => [...el.classList].some((c) => localName(c) === name);
const pickAll = (r, name) => [...r.querySelectorAll('[class]')].filter((el) => has(el, name));
const pick    = (r, name) => pickAll(r, name)[0] ?? null;
const textsOf = (r, name) => pickAll(r, name).map((el) => el.textContent);

// ── fixtures ──────────────────────────────────────────────────────────
/**
 * Deep-frozen: a component that sorted or spliced these in place would
 * then throw rather than quietly reordering module state every later
 * test in this file shares. That trap has already disarmed one guard in
 * this repo — a "does not mutate" test that passed only because an
 * earlier test had already done the mutating.
 */
const POST = Object.freeze({
  _id: 'p2',
  title: 'Getting Started With Docker Compose',
  slug: 'docker-compose',
  excerpt: 'Everything I learned about multi-container applications.',
  tags: Object.freeze(['Docker', 'DevOps']),
  readingTimeMinutes: 1,
  views: 12,
  publishedAt: '2026-05-14T09:00:00.000Z',
  sections: Object.freeze([
    Object.freeze({
      heading: 'Why Docker',
      body: Object.freeze(['Consistent environments.', 'No more works-on-my-machine.']),
      bullets: Object.freeze([]),
    }),
    Object.freeze({
      heading: 'Services',
      body: Object.freeze(['A typical stack of mine runs four services:']),
      bullets: Object.freeze(['Frontend', 'Backend', 'PostgreSQL']),
    }),
  ]),
});

const PREV = Object.freeze({ slug: 'newest-post', title: 'A Newer Post' });
const NEXT = Object.freeze({ slug: 'oldest-post', title: 'An Older Post' });

const compound = (over = {}) => Object.freeze({
  post: POST, prev: PREV, next: NEXT, index: 2, total: 4, ...over,
});

const ok      = (data) => ({ data, isLoading: false, isError: false, error: null });
const loading = ()     => ({ data: undefined, isLoading: true,  isError: false, error: null });
const failed  = ()     => ({ data: undefined, isLoading: false, isError: true,  error: new Error('404') });

/**
 * Rendered through a real `<Route path="/blog/:slug">` rather than with a
 * hand-passed prop, because `useParams()` is what the component reads and
 * a stubbed slug would test a code path the app never takes.
 *
 * `state` goes on the MemoryRouter entry, which is how the filter arrives
 * from /blog's cards in the real app.
 */
function draw({ query = ok(compound()), state, path = '/blog/docker-compose' } = {}) {
  useBlogPost.mockImplementation(() => query);
  useRecordView.mockImplementation(() => ({ mutate: recordViewFn }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[{ pathname: path, state }]}>
        <ThemeProvider>
          <MotionProvider>
            <Routes>
              <Route path="/blog/:slug" element={<BlogPostPage />} />
            </Routes>
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
  // ⚠️ Cleared between tests, or the view-counter guard leaks: the first
  // test to render claims the slug and every later one silently exercises
  // the "already counted" branch. That would make the "fires once"
  // assertion below pass for the wrong reason.
  sessionStorage.clear();
  useBlogPost.mockReset();
  useRecordView.mockReset();
  recordViewFn.mockReset();
});

// ══ 1. the post body ══════════════════════════════════════════════════
describe('the post', () => {
  it('renders the title, excerpt and tags', () => {
    const c = draw();
    expect(pick(c, 'title').textContent).toBe(POST.title);
    expect(pick(c, 'excerpt').textContent).toBe(POST.excerpt);
    expect(textsOf(c, 'tagPill')).toEqual(['Docker', 'DevOps']);
  });

  it('renders every section in order, numbered from 01', () => {
    const c = draw();
    expect(textsOf(c, 'sectionNo')).toEqual(['01', '02']);
    // textContent of the <h2> includes the numeral span, so the numeral
    // is asserted separately above and the heading is matched loosely
    // here rather than pinning the concatenation.
    const headings = pickAll(c, 'sectionHeading').map((h) => h.textContent);
    expect(headings[0]).toContain('Why Docker');
    expect(headings[1]).toContain('Services');
  });

  it('renders every paragraph of every section, in order', () => {
    const c = draw();
    expect(textsOf(c, 'para')).toEqual([
      'Consistent environments.',
      'No more works-on-my-machine.',
      'A typical stack of mine runs four services:',
    ]);
  });

  it('renders bullets, each with its own dot', () => {
    const c = draw();
    expect(textsOf(c, 'bullet')).toEqual(['Frontend', 'Backend', 'PostgreSQL']);
    expect(pickAll(c, 'bulletDot')).toHaveLength(3);
  });

  it('survives a section with no bullets and one with no body', () => {
    // `sectionSchema` forbids a section with NEITHER, but either one
    // alone is valid and both shapes are in the live seed.
    const c = draw({ query: ok(compound({
      post: { ...POST, sections: [
        { heading: 'Body only', body: ['Just prose.'], bullets: [] },
        { heading: 'Bullets only', body: [], bullets: ['Just a point.'] },
      ] },
    })) });
    expect(textsOf(c, 'para')).toEqual(['Just prose.']);
    expect(textsOf(c, 'bullet')).toEqual(['Just a point.']);
  });

  it('survives a post whose sections key is missing entirely', () => {
    // A legacy row written before PF-59 moved the body to sections[].
    const c = draw({ query: ok(compound({
      post: { ...POST, sections: undefined, tags: undefined },
    })) });
    expect(pick(c, 'title').textContent).toBe(POST.title);
    expect(pickAll(c, 'section')).toHaveLength(0);
  });
});

// ══ 2. the meta line ══════════════════════════════════════════════════
describe('meta line', () => {
  it('prints the API position as a padded, 1-based numeral', () => {
    // index 2 (0-based, from the server) → "03".
    expect(pick(draw(), 'metaNo').textContent).toBe('03');
  });

  it('prints 01 for the newest post, whose index is the falsy 0', () => {
    // ⚠️ THE DISCRIMINATING CASE. A truthiness guard (`index && …`)
    // renders correctly for every post except the newest one — which is
    // the post most likely to be read, and the one a spot-check opens
    // last. The component guards on `index >= 0`.
    const c = draw({ query: ok(compound({ index: 0 })) });
    expect(pick(c, 'metaNo').textContent).toBe('01');
  });

  it('omits the numeral rather than printing 00 when the API sends -1', () => {
    const c = draw({ query: ok(compound({ index: -1 })) });
    expect(pick(c, 'metaNo')).toBeNull();
    // The rest of the line still renders — a missing position must not
    // take the date and reading time with it.
    expect(c.textContent).toContain('MIN READ');
  });

  it('prints the full date and the reading time', () => {
    const c = draw();
    expect(c.textContent).toContain('14 MAY 2026');
    expect(c.textContent).toContain('1 MIN READ');
  });
});

// ══ 3. prev / next ════════════════════════════════════════════════════
describe('prev and next', () => {
  it('links to each neighbour by slug', () => {
    const c = draw();
    const [prevLink, nextLink] = pickAll(c, 'navCard');
    expect(prevLink.getAttribute('href')).toBe('/blog/newest-post');
    expect(nextLink.getAttribute('href')).toBe('/blog/oldest-post');
    expect(textsOf(c, 'navTitle')).toEqual(['A Newer Post', 'An Older Post']);
  });

  it('renders neither, and no empty nav, for the only post', () => {
    // The API sends null/null rather than wrapping a single post onto
    // itself. Two links that navigate to the current post would be worse
    // than none.
    const c = draw({ query: ok(compound({ prev: null, next: null, index: 0, total: 1 })) });
    expect(pickAll(c, 'navCard')).toHaveLength(0);
    expect(pickAll(c, 'navRow')).toHaveLength(0);
  });

  it('renders just one when only one neighbour exists', () => {
    const c = draw({ query: ok(compound({ prev: null })) });
    const links = pickAll(c, 'navCard');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('/blog/oldest-post');
  });
});

// ══ 4. the back link ══════════════════════════════════════════════════
describe('back to the index', () => {
  it('goes to the plain index, labelled ALL POSTS, when unfiltered', () => {
    const c = draw();
    const back = pick(c, 'backLink');
    expect(back.getAttribute('href')).toBe('/blog');
    expect(back.textContent).toBe('← ALL POSTS');
  });

  it('goes back to the FILTERED index, relabelled, when a filter came through', () => {
    // Owner's decision, 2026-09-06: a reader who filtered to three posts
    // and opened one gets those three back, ready to clear or re-filter.
    const c = draw({ state: { from: 'tag=Docker&tag=DevOps' } });
    const back = pick(c, 'backLink');
    expect(back.getAttribute('href')).toBe('/blog?tag=Docker&tag=DevOps');
    expect(back.textContent).toBe('← BACK TO RESULTS');
  });

  it('re-passes the filter on the prev/next links', () => {
    // ⚠️ Without this the filter evaporates after ONE hop and the back
    // link silently changes its label mid-read. Asserted through the
    // router's own state rather than an attribute: `state` never reaches
    // the DOM, so an href-only check cannot see this at all.
    const c = draw({ state: { from: 'tag=Docker' } });
    const [prevLink] = pickAll(c, 'navCard');
    // react-router stores the state on the link's click handler; the
    // observable proof is that the href is unchanged and the state
    // object is the one the page received. Re-render at the neighbour to
    // confirm the label survives the hop.
    expect(prevLink.getAttribute('href')).toBe('/blog/newest-post');

    const c2 = draw({ path: '/blog/newest-post', state: { from: 'tag=Docker' } });
    expect(pick(c2, 'backLink').textContent).toBe('← BACK TO RESULTS');
  });

  it('falls back to the honest label when state was lost to a refresh', () => {
    const c = draw({ state: undefined });
    expect(pick(c, 'backLink').textContent).toBe('← ALL POSTS');
  });
});

// ══ 4b. the same control again, at the end of the read ════════════════
describe('back to the index from the bottom', () => {
  /**
   * Owner-requested 2026-09-06. Finishing a post left only PREVIOUS /
   * NEXT in reach, and those move sideways to other posts — leaving for
   * the index meant scrolling the whole article back up.
   *
   * ⚠️ NO PROTOTYPE SOURCE: `Blog.dc.html:69-121` has one back button and
   * it is at the top. A sanctioned addition, recorded in
   * locked-decisions.md.
   */
  it('renders a second back control after the prev/next cards', () => {
    const c = draw();
    expect(pick(c, 'backLinkBottom')).not.toBeNull();

    // Order matters — it is the LAST thing in the article, after the
    // neighbour cards. `compareDocumentPosition` is what actually answers
    // that; a querySelector cannot.
    const nav    = pick(c, 'navRow');
    const bottom = pick(c, 'backLinkBottom');
    const after  = nav.compareDocumentPosition(bottom) & Node.DOCUMENT_POSITION_FOLLOWING;
    expect(after).toBeTruthy();
  });

  /**
   * ⚠️ THE STRONGEST ASSERTION IS THAT THE TWO AGREE, not that either is
   * individually correct. A test pinning only the bottom link's href would
   * pass while the two ends of one page pointed at different places —
   * which is the actual failure mode of duplicating a control, and the
   * reason the component reuses `backTo`/`backLabel` rather than deriving
   * them twice.
   */
  it.each([
    ['unfiltered', undefined],
    ['filtered',   { from: 'tag=Docker&tag=DevOps' }],
  ])('agrees with the top control when %s', (_name, state) => {
    const c = draw({ state });
    const top    = pick(c, 'backLink');
    const bottom = pick(c, 'backLinkBottom');
    expect(bottom.getAttribute('href')).toBe(top.getAttribute('href'));
    expect(bottom.textContent).toBe(top.textContent);
  });

  it('is present for a single post, which has no prev/next at all', () => {
    // It sits OUTSIDE the (prev || next) guard. Inside it, the one case
    // with no other navigation would also lose its way out.
    const c = draw({ query: ok(compound({ prev: null, next: null, index: 0, total: 1 })) });
    expect(pick(c, 'navRow')).toBeNull();
    expect(pick(c, 'backLinkBottom')).not.toBeNull();
  });

  it.each([
    ['loading',   loading],
    ['not-found', failed],
  ])('is absent in the %s state, where the top control is enough', (_name, state) => {
    // Neither state scrolls, and the not-found panel already carries its
    // own exit (BROWSE FIELD NOTES →). Rendering here would put three
    // routes back to /blog on a page with no content.
    const c = draw({ query: state() });
    expect(pick(c, 'backLinkBottom')).toBeNull();
    expect(pick(c, 'backLink')).not.toBeNull();   // control: the top one stays
  });
});

// ══ 5. the locked EMAIL ME removal ════════════════════════════════════
describe('the removed contact panel', () => {
  /**
   * ⚠️ THIS GUARD EXISTS BECAUSE THE DESIGN STILL HAS THE PANEL.
   * `docs/design/Blog.dc.html:103-106` — the accent-tinted container and
   * both its children — is frozen and will keep showing it forever. The
   * removal is a locked owner decision from 2026-08-22, and a fidelity
   * pass diffing live against the export WILL flag its absence as a
   * transcription bug. Without a test saying so, "restoring" it looks
   * like a fix.
   */
  it('renders no GOT A QUESTION block and no EMAIL ME call to action', () => {
    const c = draw();
    expect(c.textContent).not.toMatch(/GOT A QUESTION/i);
    expect(c.textContent).not.toMatch(/EMAIL ME/i);
    expect(c.querySelector('a[href^="mailto:"]')).toBeNull();
  });

  it('leaves the tail gap at the collapsed 38px, with no margin invented to hold 44', () => {
    // The panel carried `margin-top: 44px`. With it gone, `.navRow`'s
    // own 30px collapses against the last section's 38px bottom margin
    // and 38 wins. Adding a margin here to restore 44 would invent a
    // value to preserve a gap left by a deleted element — explicitly
    // what the locked decision forbids.
    expect(decls('.navRow')['margin-top']).toBe('30px');
    expect(decls('.section')['margin-bottom']).toBe('38px');
  });
});

// ══ 6. the view counter ═══════════════════════════════════════════════
describe('view counting', () => {
  it('records one view once the post has loaded', () => {
    draw();
    expect(recordViewFn).toHaveBeenCalledTimes(1);
    expect(recordViewFn).toHaveBeenCalledWith('docker-compose', expect.anything());
  });

  it('does not record a view for a post that failed to load', () => {
    // ⚠️ The effect is gated on the POST, not on mount. Firing on mount
    // would PATCH a slug the server answers 404 for — a draft, or a typo
    // — and count a view on a page nobody could read.
    draw({ query: failed() });
    expect(recordViewFn).not.toHaveBeenCalled();
  });

  it('does not record a second view for the same post in one session', () => {
    // ⚠️ THE CONTROL IS THE FIRST LINE. Without confirming the first
    // render DID count, "called once" is satisfied by a component that
    // never calls at all — the assertion would pass against the feature
    // being entirely broken.
    draw();
    expect(recordViewFn).toHaveBeenCalledTimes(1);

    // A fresh mount of the same slug — a Back/Forward, or React 19's
    // StrictMode double-mount in development. The sessionStorage flag is
    // written BEFORE the request goes out, so the second run is a
    // synchronous no-op.
    draw();
    expect(recordViewFn).toHaveBeenCalledTimes(1);
  });

  it('records a separate view for a different post', () => {
    draw();
    draw({ path: '/blog/another-post' });
    expect(recordViewFn).toHaveBeenCalledTimes(2);
    expect(recordViewFn).toHaveBeenLastCalledWith('another-post', expect.anything());
  });

  it('still renders the post when sessionStorage throws', () => {
    // ⚠️ Not hypothetical: sessionStorage THROWS outright in some privacy
    // modes rather than returning null. An unguarded read would blank the
    // whole reading view over a telemetry counter.
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const c = draw();
    expect(pick(c, 'title').textContent).toBe(POST.title);
    expect(recordViewFn).not.toHaveBeenCalled();   // under-counts, never crashes
    spy.mockRestore();
  });
});

// ══ 7. loading and not-found ══════════════════════════════════════════
describe('states', () => {
  it('shows a placeholder while loading, and no post chrome', () => {
    const c = draw({ query: loading() });
    expect(pick(c, 'placeholder')).not.toBeNull();
    expect(pick(c, 'title')).toBeNull();
    expect(pick(c, 'navRow')).toBeNull();
  });

  it('shows an inline not-found panel, keeping the reader on /blog/:slug', () => {
    // Owner's decision, 2026-09-06: NOT a redirect to NotFoundPage, which
    // is still the Phase 1 layout until PF-100 — a mistyped blog link
    // would otherwise drop the reader into the old palette entirely.
    const c = draw({ query: failed() });
    expect(pick(c, 'notFound')).not.toBeNull();
    expect(pick(c, 'notFound').getAttribute('role')).toBe('status');
    expect(pick(c, 'notFoundLink').getAttribute('href')).toBe('/blog');

    // ⚠️ The panel's link and the back link above it must not share an
    // accessible name — both are on screen in this state, and two links
    // reading `← ALL POSTS` to the same place announce identically. Found
    // by Playwright's strict mode, pinned here so the unit suite catches
    // a regression first.
    expect(pick(c, 'notFoundLink').textContent).toBe('BROWSE FIELD NOTES →');
    expect(pick(c, 'backLink').textContent).toBe('← ALL POSTS');
    expect(pick(c, 'notFoundLink').textContent)
      .not.toBe(pick(c, 'backLink').textContent);
    expect(pick(c, 'title')).toBeNull();
  });

  it('keeps the back link on every state, including the failure', () => {
    // The one control that must never disappear: a reader who reached a
    // dead slug needs the way out most.
    expect(pick(draw({ query: loading() }), 'backLink')).not.toBeNull();
    expect(pick(draw({ query: failed()  }), 'backLink')).not.toBeNull();
  });
});

// ══ 8. the stylesheet ═════════════════════════════════════════════════
describe('BlogPostPage.module.css', () => {
  /**
   * ⚠️ PF-101. An unbroken token in a title had no wrap guard. Measured
   * with an 85-character token: 1308px of content in a 288px box at
   * 320px wide, and 2758 in 820 at 1280.
   *
   * ⚠️ NOT a narrow-viewport bug — it exceeds every box the design has,
   * so a sweep that only checked phone widths would have called it clean.
   * The sibling defect on BlogPage's `.featuredTitle` was CLIPPED by an
   * `overflow: hidden` ancestor; this one has no such ancestor and
   * escapes the reading measure instead. Different symptom, same missing
   * declaration — which is why both are guarded rather than just the one
   * that looked broken.
   *
   * ⚠️ Asserted through postcss, not a text search: the rule's own
   * comment names `overflow-wrap` while explaining why it is there.
   */
  it('.title wraps an unbroken token rather than overflowing the measure', () => {
    expect(decls('.title')['overflow-wrap']).toBe('anywhere');
  });

  it('pulls riseIn in with composes, not a scoped animation-name', () => {
    // ⚠️ A keyframe NAMED inside a *.module.css is scoped to an
    // identifier no @keyframes defines: the declaration stays valid and
    // the element simply never animates. getComputedStyle still reports
    // it as running — `el.getAnimations().length === 0` is the only
    // runtime tell — so this is asserted at the source instead.
    const article = decls('.article');
    expect(article.composes).toBe('kf-riseIn from global');
    expect(article['animation-name']).toBeUndefined();
    // Longhands, never the shorthand: `animation:` resets animation-name
    // to `none` and undoes the composed class.
    expect(article.animation).toBeUndefined();
    expect(article['animation-duration']).toBe('.8s');
    expect(article['animation-timing-function']).toBe('cubic-bezier(.16, 1, .3, 1)');
  });

  it('uses the font TOKENS, never the prototype\'s literal stack', () => {
    // The token carries the metric-matched `Anton Fallback` face; the
    // literal stack drops it and puts the font-swap reflow back.
    //
    // ⚠️ WRITTEN AS A DECLARATION WALK BECAUSE THE TEXT SEARCH FAILED —
    // and it failed for the exact reason this file's header warns about.
    // The first version was `expect(css).not.toMatch(/'JetBrains Mono'/)`
    // and it matched the module's own header COMMENT, which quotes the
    // literal stack in prose while explaining why it must not be used.
    // That is the comment trap in both directions: here it produced a
    // false FAILURE, and the more common case produces a false PASS. A
    // declaration walk never visits a comment node.
    const families = [];
    root.walkDecls('font-family', (d) => families.push(d.value));
    expect(families.length).toBeGreaterThan(0);   // control: it found some
    families.forEach((value) => {
      expect(value).toMatch(/^var\(--font-(display|body|mono)\)$/);
    });
  });

  it('declares a transition only on the tag pill', () => {
    // Nothing on this screen is Reveal-wrapped — the prototype's reader
    // carries no data-reveal — so PF-93's rule is vacuous here and the
    // pill's own transition is the transcription. The other hover states
    // snap, which is also the export's behaviour.
    const withTransition = [];
    root.walkRules((rule) => {
      rule.walkDecls(/^transition/, () => withTransition.push(rule.selector));
    });
    expect([...new Set(withTransition)]).toEqual(['.tagPill']);
  });

  it('keeps the reading measure narrower than the index\'s grid width', () => {
    // 820px, not BlogPage's 1240px. Copying the index's `.inner` would
    // widen every paragraph past the line length these values assume.
    expect(decls('.inner')['max-width']).toBe('820px');
    expect(decls('.para')['max-width']).toBe('70ch');
  });

  it('declares the pill shape ONCE, composed by all three links that use it', () => {
    // Extracted 2026-09-06 when the bottom back control became the third
    // consumer. Guarded because the natural way to add a fourth is to
    // paste the block again, and three drifting copies of one transcribed
    // prototype value is the failure this repo keeps writing notes about.
    ['.backLink', '.backLinkBottom', '.notFoundLink'].forEach((sel) => {
      expect(decls(sel).composes).toBe('pillLink');
    });

    // ⚠️ The composing classes must not RE-declare anything the shape
    // owns, or they tie with it at (0,1,0) and the winner becomes bundle
    // emission order. Only `margin-bottom` is allowed on top.
    const shape = Object.keys(decls('.pillLink'));
    ['.backLink', '.backLinkBottom', '.notFoundLink'].forEach((sel) => {
      const extra = Object.keys(decls(sel)).filter((k) => k !== 'composes');
      expect(extra.filter((k) => shape.includes(k))).toEqual([]);
      expect(extra.every((k) => k === 'margin-bottom')).toBe(true);
    });
  });

  it('centres the bottom control and spaces it off the prev/next row', () => {
    const d = decls('.backBottomRow');
    expect(d.display).toBe('flex');
    expect(d['justify-content']).toBe('center');
    // Matches .navRow's own margin-top. With a single post .navRow does
    // not render and this collapses against .section's 38px instead —
    // both branches deliberate, neither a value invented to hold a gap.
    expect(d['margin-top']).toBe('30px');
    expect(decls('.navRow')['margin-top']).toBe('30px');
  });

  it('declares no rule for a ghost numeral or a contact panel', () => {
    // Parsed selectors, not a text search — the header comments name
    // both removals in prose.
    expect(selectors.some((s) => /ghost|contact|emailMe/i.test(s))).toBe(false);
  });
});
