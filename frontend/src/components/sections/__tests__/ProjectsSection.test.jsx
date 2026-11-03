// frontend/src/components/sections/__tests__/ProjectsSection.test.jsx
import { readFileSync } from 'fs';
import postcss from 'postcss';
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

  // PF-144: 8 → 14 — the run continues so the panel fills beside the taller
  // picture card (owner, 2026-11-03). Still static, still no typing.
  it('renders fourteen static lines, not the Phase 1 typing sequence', () => {
    const { container } = render(withMotion(<ProjectsSection />));
    const body = pick(container, 'terminalBody');
    expect(body.querySelectorAll('div')).toHaveLength(14);
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

  /**
   * ── PF-91 · THE GROUP C / GROUP D BOUNDARY ────────────────────────
   *
   * This panel is deliberately dark in BOTH themes (DESIGN.md line 85),
   * so every colour painted ON it must be theme-independent. PF-85 made
   * the caret a literal for this reason; PF-91 made the arrow line and
   * the chrome label literals for the same one.
   *
   * The hazard this guards is not a typo. In the SAME ticket,
   * `.lineSuccess` stayed `#34d399` while Contact's `.sentText` became
   * `var(--ok)` — the same green, the same concept, three files apart,
   * opposite answers. That asymmetry looks exactly like an oversight and
   * is the obvious thing for a later tidy-up to "unify". Unifying it
   * would reintroduce a 2.82:1 line on the splash-dark panel while
   * looking like a cleanup.
   *
   * ⚠️ PARSED WITH POSTCSS, NEVER SEARCHED AS TEXT. The rules above now
   * document this boundary in prose containing the literal strings
   * `var(--ok)` and `var(--faint)`, so a raw `not.toContain` would match
   * the comment explaining the rule and report PASS. Declarations are a
   * different node type from comments; a walk cannot see them.
   */
  describe('is theme-independent ink (Group C/D boundary)', () => {
    const root = postcss.parse(css);
    const TERMINAL = /^\.(terminal|line|dot)/;

    it('paints every terminal colour with a literal, never a theme token', () => {
      const tokenised = [];
      let seen = 0;
      root.walkRules((rule) => {
        if (!TERMINAL.test(rule.selector)) return;
        rule.walkDecls('color', (decl) => {
          seen++;
          if (decl.value.includes('var(')) tokenised.push(`${rule.selector} { color: ${decl.value} }`);
        });
      });
      // A scanner that matches nothing reports "no offenders" in exactly
      // the same words as a clean file — same self-check as
      // revealTransition.test.js's ">20 pairs".
      expect(seen).toBeGreaterThanOrEqual(6);
      expect(tokenised).toEqual([]);
    });

    /*
     * The token/literal split alone is not enough, and mutation testing
     * is what showed it: reverting .terminalLabel to its old #5c677d
     * left the guard green, because #5c677d is a perfectly good literal.
     * It also measures 3.04 in both themes. So the VALUES are pinned too
     * — a silent revert to a failing hex now fails.
     */
    it('pins the two colours PF-91 raised, so a revert cannot be silent', () => {
      const colourOf = (sel) => {
        let v = null;
        root.walkRules((rule) => {
          if (rule.selector !== sel) return;
          rule.walkDecls('color', (decl) => { v = decl.value.trim(); });
        });
        return v;
      };
      // #8b949e — GitHub's muted-on-#161b22. 5.62 on the chrome bar,
      // 6.15 on the panel body, both themes. Was 3.04 and 3.33/3.12.
      expect(colourOf('.terminalLabel')).toBe('#8b949e');
      expect(colourOf('.lineMuted')).toBe('#8b949e');
      // and it must stay BELOW .lineInfo, which is the panel's own
      // hierarchy — the reason this hex was chosen over a brighter one
      expect(colourOf('.lineInfo')).toBe('#93a0b8');
    });

    /*
     * ⚠️ SCOPED TO THE TERMINAL PANEL'S OWN RULES, not to the whole
     * module — narrowed 2026-08-29 when `.liveDot` was added.
     *
     * The rule PF-91 settled is about a SURFACE, not about a file:
     * `--ok` flips with the theme and the terminal panel deliberately
     * does not, so `var(--ok)` there would paint #0B6446 on a fixed
     * #0d1117 (2.82:1). `.liveDot` sits on the LIVE SITE link, which is
     * ordinary themed page surface, so `var(--ok)` is exactly right
     * there and PF-91 routed four other sites onto that token for the
     * same reason. A whole-module walk conflated the two and would have
     * pushed the live dot onto a literal — reintroducing the
     * hardcoded-pair problem PF-91 removed.
     *
     * The scope assertion below is the important half: a selector list
     * that stops matching reports "no offenders" in exactly the same
     * words as a clean panel.
     */
    it('never reads --ok or --danger on the terminal panel, which does not theme', () => {
      const TERMINAL = /^\.(terminal|terminalChrome|terminalLabel|terminalBody|trafficDot|dot(Red|Amber|Green)|line[A-Z]\w*|caret)\b/;
      const offenders = [];
      let scanned = 0;
      root.walkRules((rule) => {
        if (!TERMINAL.test(rule.selector)) return;
        scanned += 1;
        rule.walkDecls((decl) => {
          if (/var\(\s*--(ok|danger)\b/.test(decl.value)) {
            offenders.push(`${rule.selector} { ${decl.prop}: ${decl.value} }`);
          }
        });
      });
      expect(scanned, 'terminal selector list matched nothing').toBeGreaterThan(10);
      expect(offenders).toEqual([]);
    });

    it('keeps --shd on the DROP SHADOW, which should track the theme', () => {
      // The counterweight. "Literal ink" must not be over-applied into
      // literalising the shadow this panel casts onto the PAGE behind it
      // — that surface does flip, and no contrast rule reaches a shadow.
      let shadow = null;
      root.walkRules((rule) => {
        if (rule.selector !== '.terminal') return;
        rule.walkDecls('box-shadow', (decl) => { shadow = decl.value; });
      });
      expect(shadow).not.toBeNull();
      expect(shadow).toContain('var(--shd)');
    });
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
    // The big card shares its row with the terminal.
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
