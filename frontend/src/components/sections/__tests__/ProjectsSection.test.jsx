// frontend/src/components/sections/__tests__/ProjectsSection.test.jsx
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MotionProvider } from '../../../providers/MotionProvider';

// vi.mock, not vi.spyOn on the module namespace — Vite's SSR transform
// defines each export as a getter-only property, so spyOn cannot
// redefine it. Same approach as SkillsSection.test.jsx.
const useProjects = vi.hoisted(() => vi.fn());
vi.mock('../../../hooks/useProjects', () => ({ useProjects }));

const { ProjectsSection } = await import('../ProjectsSection');

const here     = dirname(fileURLToPath(import.meta.url));
const css      = readFileSync(resolve(here, '../ProjectsSection.module.css'), 'utf8');
const patterns = readFileSync(resolve(here, '../../../styles/patterns.module.css'), 'utf8');

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
const patternsRules = patterns.replace(/\/\*[\s\S]*?\*\//g, '');

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

const withMotion = (ui) => <MotionProvider>{ui}</MotionProvider>;

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
    _id: 'p1', title: 'ClearDrive.lk', description: 'Vehicle import platform.',
    tech: Object.freeze(['Python', 'FastAPI', 'Next.js']),
    githubUrl: 'https://github.com/ClearDrive-lk/cleardrive-lk',
    liveUrl: 'https://cleardrive.lk/', featured: true, order: 1,
    backgroundImage: Object.freeze({ src: '', opacity: 0.75 }),
  }),
  Object.freeze({
    _id: 'p2', title: 'Personal Portfolio', description: 'MERN portfolio.',
    tech: Object.freeze(['React 19', 'Node.js']),
    githubUrl: 'https://github.com/Chami-02/My_Portfolio',
    liveUrl: null, featured: true, order: 2,
    backgroundImage: Object.freeze({ src: '', opacity: 0.75 }),
  }),
  Object.freeze({
    _id: 'p3', title: 'Smart Campus API', description: 'JAX-RS API.',
    tech: Object.freeze(['Java', 'JAX-RS']),
    githubUrl: 'https://github.com/Chami-02/CSA_CW_W2120595_smart-campus-api',
    liveUrl: null, featured: false, order: 3,
    backgroundImage: Object.freeze({ src: '', opacity: 0.75 }),
  }),
  Object.freeze({
    _id: 'p4', title: 'Life Below Water', description: 'SDG 14 site.',
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

// ── 3 · the pill is local, not the shared one ─────────────────────────
describe('tech pill', () => {
  it('does not compose the shared .pill', () => {
    expect(cssRules).not.toMatch(/composes:\s*pill\b/);
  });

  it('differs from the shared .pill on at least three properties', () => {
    const mine   = declarations(ruleBody(cssRules, '.techPill'));
    const shared = declarations(ruleBody(patternsRules, '.pill'));
    const differing = ['display', 'padding', 'font-size']
      .filter((p) => mine[p] !== shared[p]);
    // inline-block vs inline-flex, 6px 11px vs 10px 18px, 11px vs 11px…
    expect(differing.length).toBeGreaterThanOrEqual(2);
    expect(mine.display).toBe('inline-block');
    expect(mine.padding).toBe('6px 11px');
  });

  it('declares its transition bare — it is not Reveal-wrapped', () => {
    // The prototype wraps the CARD (line 357); pills arrive with it, so
    // nothing competes for the transition property and no
    // [data-reveal='in'] gate is needed. Contrast .rolePill/.statCard.
    expect(ruleBody(cssRules, '.techPill')).toContain('transition:');
    expect(cssRules).not.toContain(".techPill[data-reveal='in']");
  });
});

// ── 4 · the scoped-keyframe silent failure ────────────────────────────
describe('caret animation', () => {
  it('reaches the keyframe through a global carrier', () => {
    expect(ruleBody(cssRules, '.caret')).toContain('composes: kf-blink from global');
  });

  it('names no keyframe anywhere in the module', () => {
    // A keyframe named inside a *.module.css is scoped and resolves to
    // nothing — valid CSS naming an animation that does not exist. The
    // only reliable runtime tell is getAnimations().length === 0.
    expect(cssRules).not.toMatch(/animation-name\s*:/);
    expect(cssRules).not.toMatch(/animation\s*:\s*[^;]*\bblink\b/);
    expect(cssRules).not.toMatch(/@keyframes/);
  });

  it('colours the caret with a LITERAL, not the themed accent', () => {
    // The panel is a fixed dark image; --acc is #FCA311 dark but #7E4800
    // light, which measures 2.54:1 on #0d1117. The seven sibling log lines
    // are already literal hexes. Reverting this to var(--acc) to "match the
    // prototype" reintroduces the light-theme failure.
    const body = ruleBody(cssRules, '.caret');
    expect(body).toContain('color: #FCA311');
    expect(body).not.toContain('var(--acc');
  });

  it('uses longhands, never the shorthand', () => {
    // `animation: 1s step-end infinite` would reset animation-name to
    // `none` and silently undo the composed class.
    const body = ruleBody(cssRules, '.caret');
    expect(body).toContain('animation-duration: 1s');
    expect(body).toContain('animation-timing-function: step-end');
    expect(body).toContain('animation-iteration-count: infinite');
  });
});

// ── 5 · hover easing stays the prototype's snap ───────────────────────
describe('card hover', () => {
  it.each(['.bigCard', '.card'])('%s declares no transition', (sel) => {
    // The prototype supplies only a style-hover end state on both cards
    // (lines 318, 357) — they snap. About and Skills ease at .25s under
    // an owner approval from 2026-08-18 that covered those two sections
    // and was NOT extended here. If it is extended later, `.card` is
    // Reveal-wrapped and the transition must be gated
    // `.card[data-reveal='in']` or it eats the 1.05s entrance easing.
    expect(declarations(ruleBody(cssRules, sel)).transition).toBeUndefined();
  });

  it('still applies the prototype hover end state', () => {
    expect(ruleBody(cssRules, '.card:hover')).toContain('translateY(-8px)');
    expect(ruleBody(cssRules, '.bigCard:hover')).toContain('translateY(-8px)');
  });
});

// ── 6 · content must clear both layers ────────────────────────────────
describe('content stacking', () => {
  it('excludes both layer classes from the z-index rule', () => {
    // Dropping either from the :not() list puts z-index 2 on the layer
    // itself, painting the background image over the text. Nothing
    // errors and no element-counting test notices — the text is still
    // in the DOM, just covered.
    expect(cssRules).toContain('.card > *:not(.cardBg):not(.cardScrim)');
    expect(cssRules).toContain('.bigCard > *:not(.cardBg):not(.cardScrim)');
  });
});

// ── 7 · 8 · the background bridge ─────────────────────────────────────
describe('card background layers', () => {
  it('renders neither layer when src is empty', () => {
    const { container } = render(withMotion(<ProjectsSection />));
    expect(pickAll(container, 'cardBg')).toHaveLength(0);
    expect(pickAll(container, 'cardScrim')).toHaveLength(0);
  });

  it('renders both layers with the prototype opacities when src is set', () => {
    const withBg = PROJECTS.map((p, i) =>
      i === 0
        ? { ...p, backgroundImage: { src: 'https://cdn.example/a.png', opacity: 0.75 } }
        : p,
    );
    useProjects.mockReturnValue(ok(withBg));
    const { container } = render(withMotion(<ProjectsSection />));

    const bg    = pick(container, 'cardBg');
    const scrim = pick(container, 'cardScrim');
    expect(bg.style.opacity).toBe('0.75');
    expect(bg.style.backgroundImage).toBe('url("https://cdn.example/a.png")');
    // ⚠️ 0.8999999999999999, NOT 0.9 — and that is correct, not a bug to
    // round away. 0.45 + 0.75 * 0.6 is not exactly representable in IEEE
    // 754, and the prototype's own `String(Math.min(1, 0.45 + vis*0.6))`
    // (line 695) produces this identical string. Asserting '0.9' would
    // force a deviation from the design to make the test look tidy.
    // Verified in node against the prototype's expression.
    expect(scrim.style.opacity).toBe('0.8999999999999999');
  });

  it('clamps the scrim at 1 for a fully opaque background', () => {
    // 0.45 + 1 * 0.6 = 1.05 → Math.min(1, …) = 1.
    const withBg = PROJECTS.map((p, i) =>
      i === 0
        ? { ...p, backgroundImage: { src: 'https://cdn.example/a.png', opacity: 1 } }
        : p,
    );
    useProjects.mockReturnValue(ok(withBg));
    const { container } = render(withMotion(<ProjectsSection />));
    expect(pick(container, 'cardScrim').style.opacity).toBe('1');
  });

  it('does not emit url("[object Object]") — guards on .src, not the object', () => {
    const { container } = render(withMotion(<ProjectsSection />));
    expect(container.innerHTML).not.toContain('[object Object]');
  });
});

// ── 9 · 10 · the badge and the numeral series ─────────────────────────
describe('featured slot and numerals', () => {
  it('gives the big card the FEATURED badge and no numeral', () => {
    const { container } = render(withMotion(<ProjectsSection />));
    expect(screen.getByText('FEATURED')).toBeTruthy();
    expect(pickAll(container, 'featuredBadge')).toHaveLength(1);
  });

  it('renders NOTHING in that slot when projects[0] is not featured', () => {
    // Reachable by one untick in the admin panel. The prototype has no
    // "01" anywhere — its series starts at 02 precisely because the big
    // card does not participate — so inventing one would mean inventing
    // type styling with no design source.
    const unfeatured = [{ ...PROJECTS[0], featured: false }, ...PROJECTS.slice(1)];
    useProjects.mockReturnValue(ok(unfeatured));
    const { container } = render(withMotion(<ProjectsSection />));

    expect(screen.queryByText('FEATURED')).toBeNull();
    expect(screen.queryByText('01')).toBeNull();
    expect(pickAll(container, 'numeral').map((n) => n.textContent))
      .toEqual(['02', '03', '04']);
  });

  it('hides the decorative numerals from the accessibility tree', () => {
    // They carry no information the heading does not, and they announce as
    // "02" before every project title.
    const { container } = render(withMotion(<ProjectsSection />));
    const numerals = pickAll(container, 'numeral');
    expect(numerals).toHaveLength(3);
    numerals.forEach((n) => expect(n.getAttribute('aria-hidden')).toBe('true'));
  });

  it('numbers the remaining cards 02 03 04', () => {
    const { container } = render(withMotion(<ProjectsSection />));
    expect(pickAll(container, 'numeral').map((n) => n.textContent))
      .toEqual(['02', '03', '04']);
  });

  it('continues to 05 with a fifth project', () => {
    const five = [...PROJECTS, {
      _id: 'p5', title: 'Fifth', description: 'Added via the admin panel.',
      tech: ['Go'], githubUrl: 'https://example.com', liveUrl: null,
      featured: false, order: 5, backgroundImage: { src: '', opacity: 0.75 },
    }];
    useProjects.mockReturnValue(ok(five));
    const { container } = render(withMotion(<ProjectsSection />));
    expect(pickAll(container, 'numeral').map((n) => n.textContent))
      .toEqual(['02', '03', '04', '05']);
  });

  it('puts the FIRST project by order in the big slot, not the featured one', () => {
    const { container } = render(withMotion(<ProjectsSection />));
    const big = pick(container, 'bigCard');
    expect(big.textContent).toContain('ClearDrive.lk');
    // Personal Portfolio is also featured:true but is second by order,
    // so it must render as a numbered card rather than a second big one.
    expect(pickAll(container, 'bigCard')).toHaveLength(1);
    expect(pick(container, 'grid').textContent).toContain('Personal Portfolio');
  });
});

// ── 11 · both links on the big card ───────────────────────────────────
describe('links', () => {
  it('renders GitHub and LIVE SITE on the big card when liveUrl is set', () => {
    const { container } = render(withMotion(<ProjectsSection />));
    const row = pick(container, 'featuredLinkRow');
    const hrefs = [...row.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual([
      'https://github.com/ClearDrive-lk/cleardrive-lk',
      'https://cleardrive.lk/',
    ]);
  });

  it('omits LIVE SITE when liveUrl is null', () => {
    const { container } = render(withMotion(<ProjectsSection />));
    // Personal Portfolio (card 02) has liveUrl null.
    const rows = pickAll(container, 'linkRow');
    expect(rows[0].querySelectorAll('a')).toHaveLength(1);
  });

  it('pins the big card link row to the bottom without shrinking it', () => {
    const decls = declarations(ruleBody(cssRules, '.featuredLinkRow'));
    expect(decls['margin-top']).toBe('auto');
    expect(decls['flex-wrap']).toBe('wrap');
    // align-self: flex-start would shrink the row to its content and
    // stop flex-wrap working on a narrow card.
    expect(decls['align-self']).toBeUndefined();
  });

  it('closes the reverse-tabnabbing hole on every external link', () => {
    const { container } = render(withMotion(<ProjectsSection />));
    [...container.querySelectorAll('a[target="_blank"]')].forEach((a) => {
      expect(a.getAttribute('rel')).toContain('noreferrer');
    });
  });
});

// ── 12 · the light-theme shadow hook ──────────────────────────────────
describe('terminal panel', () => {
  it('carries data-terminal', () => {
    // tokens.css:229's html[data-theme="light"] [data-terminal] rule is
    // an attribute selector, so it is NOT scoped by CSS Modules and
    // reaches this element as-is. Drop the attribute and the light-theme
    // shadow silently reverts to the heavier inline one, with nothing
    // wrong in either file read on its own — the exact failure mode
    // data-lightplate documents.
    const { container } = render(withMotion(<ProjectsSection />));
    expect(container.querySelectorAll('[data-terminal]')).toHaveLength(1);
  });

  it('renders eight static lines, not the Phase 1 typing sequence', () => {
    const { container } = render(withMotion(<ProjectsSection />));
    const body = pick(container, 'terminalBody');
    expect(body.querySelectorAll('div')).toHaveLength(8);
    expect(body.textContent).toContain('$ docker compose up --build');
    expect(body.textContent).toContain('VITE v8 ready in 420ms');
  });

  it('keeps the mockup port :5000, not this repo\'s 5050', () => {
    const { container } = render(withMotion(<ProjectsSection />));
    expect(pick(container, 'terminalBody').textContent).toContain('Express API on :5000');
  });

  it('renders even while projects are loading', () => {
    // Hardcoded content with no API dependency — gating it behind the
    // query would blank it for no reason.
    useProjects.mockReturnValue({ data: undefined, isLoading: true, isError: false, error: null });
    const { container } = render(withMotion(<ProjectsSection />));
    expect(container.querySelectorAll('[data-terminal]')).toHaveLength(1);
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
    expect(pickAll(container, 'bigCard')).toHaveLength(0);
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
