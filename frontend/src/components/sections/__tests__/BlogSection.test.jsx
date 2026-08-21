// frontend/src/components/sections/__tests__/BlogSection.test.jsx
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import postcss from 'postcss';
import { MemoryRouter } from 'react-router-dom';
import { MotionProvider } from '../../../providers/MotionProvider';

// vi.mock, not vi.spyOn on the module namespace — Vite's SSR transform
// defines each export as a getter-only property, so spyOn cannot
// redefine it. Hoisted above the BlogSection import by Vitest.
const useBlogPosts = vi.hoisted(() => vi.fn());
vi.mock('../../../hooks/useBlog', () => ({ useBlogPosts }));

const { BlogSection } = await import('../BlogSection');

const here = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(here, '../BlogSection.module.css');
const css = readFileSync(cssPath, 'utf8');

/**
 * ⚠️ Every CSS assertion in this file goes through postcss, never a
 * regex over the raw text. This module documents the removed section
 * wash, the sweep layer's `background-size`, the PF-93 no-transition
 * rule and the four-way pill comparison IN PROSE — so a
 * `not.toContain('background')` or a `toContain('transition')` against
 * the source string matches the comment explaining the rule rather than
 * the rule. Eight test files in this repo carry a comment-stripping
 * workaround for exactly that, and five of those guards were blind on
 * first write. Parsing is immune rather than defended: a comment is a
 * distinct node type that a declaration walk never visits.
 */
const root = postcss.parse(css);

/** Declarations of one rule, by exact selector, as { prop: value }. */
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

/** Every selector in the file, so an assertion can prove an absence. */
const selectors = (() => {
  const out = [];
  root.walkRules((rule) => out.push(...rule.selectors));
  return out;
})();

/** Every `transition*` declaration in the file, with its selector. */
const transitions = (() => {
  const out = [];
  root.walkRules((rule) => {
    rule.walkDecls(/^transition/, (d) => out.push({ selector: rule.selector, prop: d.prop, value: d.value }));
  });
  return out;
})();

// ── DOM lookup by CSS-Module local name, matched EXACTLY ──────────────
// `[class*="row"]` would also match `titleRow`, `rowMeta`, `rowTitle`,
// `rowTagRow`, `rowChevron`, `rowPlaceholder` and `featuredTagRow`;
// `[class*="card"]` matches `featuredCard`; `[class*="pill"]` matches
// `tagPill`. Every one of those collisions reads as a component bug
// rather than a selector bug, which is why this file never uses a
// substring match.
function localName(token) {
  const scoped = /^_(.+)_[^_]+$/.exec(token);   // Vitest:   _row_f5cf21
  if (scoped) return scoped[1];
  const named = /__(.+)$/.exec(token);          // Vite dev: File-module__row
  return named ? named[1] : token;
}
const has = (el, name) => [...el.classList].some((c) => localName(c) === name);
const pickAll = (r, name) => [...r.querySelectorAll('[class]')].filter((el) => has(el, name));
const pick = (r, name) => pickAll(r, name)[0] ?? null;

// ── fixture ───────────────────────────────────────────────────────────
/**
 * Four posts with DISTINCT createdAt values, deliberately supplied in
 * the wrong order — oldest first — so that a component which never
 * sorts fails every ordering assertion below. The API does sort
 * `createdAt: -1` itself (blogController.js:25), which is exactly why
 * the fixture must not: a pre-sorted fixture lets a non-sorting
 * component pass.
 *
 * Deep-frozen. Not belt-and-braces: this is module state shared by
 * every test in the file, so a component that sorted its input in place
 * would sort POSTS during the first test and leave the dedicated
 * mutation check further down with nothing to detect — a clean PASS on
 * a real defect. Freezing turns every render in this file into a guard.
 * (Found this way in PF-82, on SkillsSection's fixture.)
 */
const POSTS = Object.freeze([
  {
    _id: 'p4',
    title: 'Building REST APIs with Java and JAX-RS',
    slug: 'building-rest-apis-with-java-and-jax-rs',
    excerpt: 'CRUD, resource routing, exception mapping and request logging.',
    tags: Object.freeze(['Java', 'REST API']),
    readingTimeMinutes: 5,
    createdAt: '2026-04-11T10:00:00.000Z',
  },
  {
    _id: 'p3',
    title: 'Getting Started with Docker Compose',
    slug: 'getting-started-with-docker-compose',
    excerpt: 'Managing multi-container apps in one command.',
    tags: Object.freeze(['Docker', 'DevOps']),
    readingTimeMinutes: 4,
    createdAt: '2026-05-11T10:00:00.000Z',
  },
  {
    _id: 'p2',
    title: 'Developing ClearDrive.lk with FastAPI and Docker',
    slug: 'developing-cleardrivelk-with-fastapi-and-docker',
    excerpt: 'A scalable vehicle-import platform with FastAPI and Redis.',
    tags: Object.freeze(['FastAPI', 'Python', 'Agile']),
    readingTimeMinutes: 7,
    createdAt: '2026-06-11T10:00:00.000Z',
  },
  {
    _id: 'p1',
    title: 'Building a production-style MERN portfolio',
    slug: 'building-a-production-style-mern-portfolio',
    excerpt: 'How I designed and developed this portfolio.',
    tags: Object.freeze(['React', 'MERN', 'Docker', 'GitHub Actions']),
    readingTimeMinutes: 6,
    createdAt: '2026-07-11T10:00:00.000Z',
  },
]);

const ok = (data) => ({ data, isLoading: false, isError: false, error: null });

function mockMatchMedia(matches) {
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches, addEventListener: () => {}, removeEventListener: () => {},
  })));
}

function draw(state = ok(POSTS)) {
  useBlogPosts.mockReturnValue(state);
  return render(
    <MemoryRouter>
      <MotionProvider><BlogSection /></MotionProvider>
    </MemoryRouter>,
  ).container;
}

beforeEach(() => { mockMatchMedia(false); useBlogPosts.mockReset(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

// ══ 1. the section element ════════════════════════════════════════════
describe('the section element', () => {
  it('qualifies the class with the element name, so the [id] tie is avoided', () => {
    // global.css:338's `[id] { scroll-margin-top: 5rem }` is (0,1,0) —
    // identical to a bare class, so a `.blog { … }` rule would lose the
    // tie on stylesheet order and compute 80px against a 71px header.
    // `section.blog` is (0,1,1) and settles it outright.
    expect(selectors).toContain('section.blog');
    expect(selectors).not.toContain('.blog');
    expect(decls('section.blog')['scroll-margin-top']).toBe('var(--header-h)');
  });

  it('renders with the #blog anchor Navbar.jsx links to', () => {
    const c = draw();
    expect(c.querySelector('section#blog')).not.toBeNull();
  });
});

// ══ 2 & 3. the wash comes out, the sweep layer stays ══════════════════
describe('the section wash is omitted and the sweep layer is not', () => {
  it('declares no background of any kind on the section', () => {
    // The prototype's line 414 carries
    //   linear-gradient(180deg, rgba(var(--gnd),.3) 0%,
    //     rgba(var(--ftr),.68) 50%, rgba(var(--gnd),.3) 100%)
    // and it is omitted under the 2026-08-18 site-wide wash removal.
    // Asserted as an ABSENCE so a later fidelity pass diffing against
    // the prototype does not read it as un-transcribed and paint it
    // back — this is a real removal, unlike Projects, which never had
    // one in either phase.
    const props = Object.keys(decls('section.blog'));
    expect(props.filter((p) => p.startsWith('background'))).toEqual([]);
  });

  it('keeps the featured card its own gradient — the removal is section-scoped', () => {
    // Over-deleting in service of the assertion above would take the
    // card surface with it. Same guard Skills carries.
    expect(decls('.featuredCard').background).toContain('linear-gradient(155deg');
  });

  it('keeps the sweep layer, which is card content and not a wash', () => {
    const d = decls('.sweep');
    expect(d['background-size']).toBe('100% 320%');
    expect(d.background).toContain('rgba(252, 163, 17, .14) 50%');
    expect(d['mix-blend-mode']).toBe('screen');
    expect(d.opacity).toBe('.5');
  });
});

// ══ 7. the sweep animation resolves to a real keyframe ════════════════
describe('the sweep animation', () => {
  it('composes the global carrier instead of naming the keyframe', () => {
    // A keyframe name written inside a *.module.css is SCOPED by the
    // compiler and resolves to nothing. The declaration stays valid,
    // the element simply never animates, and getComputedStyle still
    // reports it as running — only getAnimations().length gives it
    // away. It cost the whole splash, the navbar pill and Marquee
    // before anyone noticed.
    expect(decls('.sweep').composes).toBe('kf-sweep from global');
  });

  it('spells the timing as longhands, never the shorthand', () => {
    // The shorthand resets every longhand it omits, so
    // `animation: 9s linear infinite` would set animation-name back to
    // `none` and undo the composed class.
    const d = decls('.sweep');
    expect(d.animation).toBeUndefined();
    expect(d['animation-duration']).toBe('9s');
    expect(d['animation-timing-function']).toBe('linear');
    expect(d['animation-iteration-count']).toBe('infinite');
  });

  it('names no keyframe anywhere in the module', () => {
    const named = [];
    root.walkDecls(/^animation(-name)?$/, (d) => named.push(d.value));
    expect(named.filter((v) => /sweep/.test(v))).toEqual([]);
    expect(root.nodes.filter((n) => n.type === 'atrule' && n.name === 'keyframes')).toEqual([]);
  });
});

// ══ 4 & 5. PF-93 — transitions ════════════════════════════════════════
describe('PF-93: transitions', () => {
  // The repo-wide scanner in styles/__tests__/revealTransition.test.js
  // covers this structurally, by reading the JSX. These two are the
  // local, readable statement of the same rule — and the second one is
  // the half the scanner cannot make: that the pill KEEPS its own.
  const REVEAL_WRAPPED = ['eyebrow', 'heading', 'count', 'featuredCard', 'row', 'browseAll'];

  it.each(REVEAL_WRAPPED)('declares no transition on .%s, at any selector', (name) => {
    const re = new RegExp(`\\.${name}(?![\\w-])`);
    expect(transitions.filter((t) => re.test(t.selector))).toEqual([]);
  });

  it('declares exactly one transition in the whole file, and it is the tag pill', () => {
    // The pill sits INSIDE the reveal target rather than being it, so
    // the prototype's hideReveals() never writes an inline transition
    // over it and its own declaration is what applies — in the export
    // as much as here. Over-applying PF-93's rule would delete it and
    // silently drop the pill's hover easing.
    expect(transitions).toHaveLength(1);
    expect(transitions[0].selector).toBe('.tagPill');
    expect(transitions[0].value)
      .toBe('background .25s, color .25s, border-color .25s, transform .25s');
  });

  it('does not reintroduce the dead [data-reveal=in] gate', () => {
    expect(selectors.filter((s) => /\[data-reveal/.test(s))).toEqual([]);
  });
});

// ══ 6. the pill is a fourth variant, composed from nothing ════════════
describe('the tag pill', () => {
  const skills = postcss.parse(
    readFileSync(resolve(here, '../SkillsSection.module.css'), 'utf8'),
  );
  const projects = postcss.parse(
    readFileSync(resolve(here, '../ProjectsSection.module.css'), 'utf8'),
  );
  const declsOf = (parsed, selector) => {
    let out = null;
    parsed.walkRules((r) => {
      if (r.selector === selector) { out = {}; r.walkDecls((d) => { out[d.prop] = d.value; }); }
    });
    return out;
  };

  const blog = decls('.tagPill');

  it('composes nothing — not Skills, not Projects, not patterns', () => {
    expect(blog.composes).toBeUndefined();
  });

  it('differs from the Skills pill on at least three properties', () => {
    const other = declsOf(skills, '.pill');
    const differing = Object.keys(blog).filter((p) => other[p] !== blog[p]);
    // font-size 10.5px vs 12px, padding 5px 10px vs 7px 12px, and a
    // letter-spacing Skills does not have at all.
    expect(differing).toEqual(expect.arrayContaining(['font-size', 'padding', 'letter-spacing']));
    expect(differing.length).toBeGreaterThanOrEqual(3);
  });

  it('differs from the Projects pill on at least three properties', () => {
    const other = declsOf(projects, '.techPill');
    const differing = Object.keys(blog).filter((p) => other[p] !== blog[p]);
    expect(differing.length).toBeGreaterThanOrEqual(3);
  });

  it('carries the prototype values verbatim', () => {
    expect(blog['font-size']).toBe('10.5px');
    expect(blog.padding).toBe('5px 10px');
    expect(blog['letter-spacing']).toBe('.06em');
    expect(blog['border-radius']).toBe('999px');
    expect(decls('.tagPill:hover').transform).toBe('translateY(-3px) scale(1.05)');
  });
});

// ══ 8 & 10. grid geometry ═════════════════════════════════════════════
describe('grid geometry', () => {
  it('starts the outer grid rather than stretching it', () => {
    // `stretch` would grow the right column to the featured card's
    // height and spread its 12px gaps out to fill the difference.
    expect(decls('.grid')['align-items']).toBe('start');
  });

  it('gives the compact row body min-width: 0', () => {
    // A grid item defaults to `min-width: auto`, which refuses to
    // shrink below its content's intrinsic width — so a long unbroken
    // title pushes the 1fr column past its share and shoves the
    // chevron column off the card's edge.
    expect(decls('.rowBody')['min-width']).toBe('0');
  });

  it('keeps the browse-all border dashed, not solid', () => {
    expect(decls('.browseAll').border).toBe('1px dashed rgba(252, 163, 17, .35)');
  });
});

// ══ rendering: selection, order, numerals ═════════════════════════════
describe('post selection and order', () => {
  it('features the most recent post, newest first', () => {
    const c = draw();
    expect(pick(c, 'featuredTitle').textContent)
      .toBe('Building a production-style MERN portfolio');
    expect(pickAll(c, 'rowTitle').map((e) => e.textContent)).toEqual([
      'Developing ClearDrive.lk with FastAPI and Docker',
      'Getting Started with Docker Compose',
      'Building REST APIs with Java and JAX-RS',
    ]);
  });

  it('shows at most four posts however many exist', () => {
    const extra = { ...POSTS[0], _id: 'p0', title: 'Fifth', createdAt: '2026-03-01T10:00:00.000Z' };
    const c = draw(ok([...POSTS, extra]));
    expect(pickAll(c, 'featuredCard')).toHaveLength(1);
    expect(pickAll(c, 'row')).toHaveLength(3);
    expect(screen.queryByText('Fifth')).toBeNull();
  });

  it('does not sort the hook\'s array in place', () => {
    // POSTS is frozen, so an in-place sort throws rather than passing
    // quietly — and because the fixture is shared, it throws in every
    // test in this file rather than only in this one.
    expect(() => draw()).not.toThrow();
    expect(POSTS.map((p) => p._id)).toEqual(['p4', 'p3', 'p2', 'p1']);
  });

  it('breaks a createdAt tie by _id ascending, which is insertion order', () => {
    // The live seed inserts all four posts with one insertMany, so
    // every createdAt is identical and a pure date sort leaves the
    // order undefined — the API currently returns JAX-RS first, which
    // would put it in the LATEST POST slot. An ObjectId's trailing
    // counter increments within a single insertMany, so _id ascending
    // recovers insertion order, which is the prototype's own 01·02·03·04.
    //
    // The fixture's _ids run p1..p4 in the seed's own insertion order —
    // MERN, ClearDrive, Docker, JAX-RS — while the ARRAY is supplied
    // reversed, so this cannot pass by accident on input order.
    const tied = POSTS.map((p) => ({ ...p, createdAt: '2026-08-09T05:56:05.288Z' }));
    const c = draw(ok(tied));
    expect(pick(c, 'featuredTitle').textContent)
      .toBe('Building a production-style MERN portfolio');   // p1
    expect(pickAll(c, 'rowTitle').map((e) => e.textContent)).toEqual([
      'Developing ClearDrive.lk with FastAPI and Docker',    // p2
      'Getting Started with Docker Compose',                 // p3
      'Building REST APIs with Java and JAX-RS',             // p4
    ]);
  });
});

// ══ 9 & 12. numerals and the badge ════════════════════════════════════
describe('numerals and the badge', () => {
  it('renders 01 · 02 · 03 · 04 and hides all four from assistive tech', () => {
    const c = draw();
    const ghost = pick(c, 'ghostNumeral');
    const rows = pickAll(c, 'rowNumeral');
    expect(ghost.textContent).toBe('01');
    expect(rows.map((e) => e.textContent)).toEqual(['02', '03', '04']);
    for (const el of [ghost, ...rows]) expect(el).toHaveAttribute('aria-hidden', 'true');
  });

  it('continues the series rather than hardcoding three rows', () => {
    const c = draw(ok(POSTS.slice(0, 3)));
    expect(pickAll(c, 'rowNumeral').map((e) => e.textContent)).toEqual(['02', '03']);
  });

  it('renders exactly one LATEST POST badge', () => {
    const c = draw();
    expect(pickAll(c, 'badge')).toHaveLength(1);
    expect(screen.getAllByText('LATEST POST')).toHaveLength(1);
  });
});

// ══ 11. the derived post count ════════════════════════════════════════
describe('the post count', () => {
  it('derives from the number of published posts, not the literal 4', () => {
    expect(pick(draw(), 'count').textContent).toBe('4 POSTS · NOTES FROM THE BUILD');
  });

  it('counts every post, not the four on screen', () => {
    // The teaser shows four; the label says how many exist. A count of
    // the rendered cards would be permanently stuck at 4 and could
    // never diverge, which is the whole reason for deriving it.
    const extra = { ...POSTS[0], _id: 'p0', title: 'Fifth', createdAt: '2026-03-01T10:00:00.000Z' };
    expect(pick(draw(ok([...POSTS, extra])), 'count').textContent)
      .toBe('5 POSTS · NOTES FROM THE BUILD');
  });

  it('is absent rather than "0 POSTS" while loading', () => {
    const c = draw({ data: undefined, isLoading: true, isError: false, error: null });
    expect(pick(c, 'count')).toBeNull();
  });
});

// ══ meta formatting ═══════════════════════════════════════════════════
describe('date and read time', () => {
  it('formats the month with a fixed locale and the read time from the schema field', () => {
    // en-GB, not the visitor's locale: a Sinhala or Japanese month name
    // has no styling in a design that sets uppercase mono at .12em.
    const c = draw();
    expect(pick(c, 'featuredMeta').textContent).toContain('JUL 2026');
    expect(pick(c, 'featuredMeta').textContent).toContain('6 MIN READ');
    expect(pickAll(c, 'rowMeta')[0].textContent).toContain('JUN 2026');
    expect(pickAll(c, 'rowMeta')[0].textContent).toContain('7 MIN READ');
  });

  it('passes an explicit locale, not the visitor\'s default', () => {
    // ⚠️ Asserting the STRING cannot catch this. `JUL 2026` is what
    // `toLocaleDateString(undefined, …)` produces too on any en-*
    // runner, so dropping the locale argument passes every other
    // assertion in this file — confirmed by mutation, which is how this
    // test came to exist. The contract is "a fixed locale is passed",
    // so that is what gets asserted.
    const spy = vi.spyOn(Date.prototype, 'toLocaleDateString');
    draw();
    expect(spy).toHaveBeenCalled();
    for (const call of spy.mock.calls) expect(typeof call[0]).toBe('string');
    spy.mockRestore();
  });

  it('renders nothing for a month it cannot parse rather than "INVALID DATE"', () => {
    const c = draw(ok([{ ...POSTS[3], createdAt: undefined }]));
    expect(pick(c, 'featuredMeta').textContent).not.toMatch(/INVALID/i);
  });
});

// ══ 13. links resolve to a real route ═════════════════════════════════
describe('links', () => {
  it('points all five at /blog, never at the prototype\'s dead #blog anchor', () => {
    // The prototype gives all four post links href="#blog" — the
    // section's own id — because Claude Design has no post-detail
    // screen to target. Its fifth link goes to Blog.dc.html, which is
    // what proves navigation is intended. Neither /blog nor
    // /blog/:slug exists in App.jsx today, so all five point at /blog
    // and Sprint 13 narrows the post cards.
    const c = draw();
    const hrefs = [...c.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toHaveLength(5);
    expect(hrefs).toEqual(['/blog', '/blog', '/blog', '/blog', '/blog']);
    expect(hrefs.some((h) => h.startsWith('#'))).toBe(false);
  });

  it('uses React Router, so navigation stays client-side', () => {
    // A plain <a href="/blog"> would full-page reload, discarding the
    // TanStack Query cache and replaying the splash. Phase 1's
    // BlogSection did exactly that.
    const c = draw();
    // MemoryRouter renders Link as an <a> with a router-managed onclick;
    // outside a Router, Link throws. Rendering at all proves the Link
    // path — this assertion pins the rendered element type.
    expect(pick(c, 'featuredCard').tagName).toBe('A');
    expect(pick(c, 'browseAll').tagName).toBe('A');
  });
});

// ══ loading ═══════════════════════════════════════════════════════════
describe('the loading state', () => {
  const loading = { data: undefined, isLoading: true, isError: false, error: null };

  it('shows one featured placeholder and three row placeholders, all aria-hidden', () => {
    const c = draw(loading);
    const feat = pickAll(c, 'featuredPlaceholder');
    const rows = pickAll(c, 'rowPlaceholder');
    expect(feat).toHaveLength(1);
    expect(rows).toHaveLength(3);
    for (const el of [...feat, ...rows]) expect(el).toHaveAttribute('aria-hidden', 'true');
  });

  it('uses bare divs, not Reveals — a slot must not animate twice', () => {
    const c = draw(loading);
    for (const el of [...pickAll(c, 'featuredPlaceholder'), ...pickAll(c, 'rowPlaceholder')]) {
      expect(el.tagName).toBe('DIV');
      expect(el).not.toHaveAttribute('data-reveal');
    }
  });

  it('keeps the browse-all link, which has no dependency on the query', () => {
    expect(pick(draw(loading), 'browseAll')).not.toBeNull();
  });

  it('carries the measured min-heights', () => {
    expect(decls('.featuredPlaceholder')['min-height']).toBe('394px');
    expect(decls('.rowPlaceholder')['min-height']).toBe('177px');
  });
});

// ══ 15. error ═════════════════════════════════════════════════════════
describe('the error state', () => {
  const failed = {
    data: undefined, isLoading: false, isError: true, error: new Error('boom'),
  };

  it('keeps the section, the heading and the #blog anchor', () => {
    // Returning null would turn Navbar.jsx:12's `#blog` link into a
    // dead anchor with no feedback at all.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const c = draw(failed);
    expect(c.querySelector('section#blog')).not.toBeNull();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/Field\s*Notes/);
    spy.mockRestore();
  });

  it('drops the grid', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const c = draw(failed);
    expect(pick(c, 'grid')).toBeNull();
    expect(pick(c, 'featuredCard')).toBeNull();
    spy.mockRestore();
  });

  it('logs once from an effect rather than from the render body', () => {
    // A render-phase console.error fires again on every unrelated
    // re-render — a theme toggle, a parent state change — turning one
    // failed fetch into a console full of duplicates.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    useBlogPosts.mockReturnValue(failed);
    const { rerender } = render(
      <MemoryRouter><MotionProvider><BlogSection /></MotionProvider></MemoryRouter>,
    );
    rerender(<MemoryRouter><MotionProvider><BlogSection /></MotionProvider></MemoryRouter>);
    const ours = spy.mock.calls.filter((c) => String(c[0]).includes('BlogSection'));
    expect(ours).toHaveLength(1);
    spy.mockRestore();
  });
});

// ══ empty ═════════════════════════════════════════════════════════════
describe('with no published posts', () => {
  it('keeps the section and its anchor rather than returning null', () => {
    // Phase 1 returned null here, which is the dead-anchor bug again.
    const c = draw(ok([]));
    expect(c.querySelector('section#blog')).not.toBeNull();
    expect(pick(c, 'count')).toBeNull();
    expect(pick(c, 'featuredCard')).toBeNull();
  });
});
