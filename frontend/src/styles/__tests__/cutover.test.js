// frontend/src/styles/__tests__/cutover.test.js
//
// PF-89 — the guard that outlives the deletions.
//
// ⚠️ Cross-cutting on purpose, and it breaks the per-module __tests__
// convention deliberately. It belongs to no single module — the modules it
// is about were deleted. `styles/__tests__/revealTransition.test.js` (PF-93)
// and `styles/__tests__/mobile.test.js` (PF-88) set that precedent; this is
// the third, and CLAUDE.md says to follow it rather than invent a top-level
// `src/__tests__/`.
//
// WHY A TEST AT ALL, for code that is gone:
//
// CLAUDE.md documents at length that a green suite ACTIVELY HIDES dead code —
// a module's own test keeps reporting PASS forever after its last consumer
// disappears, because the test imports the module directly. `useTypewriter`
// sat there with four passing tests and zero consumers from PF-80 to PF-89,
// and three separate dead-code sweeps walked past it for exactly that reason.
//
// The mirror-image hazard is what this file covers: nothing anywhere fails if
// someone REINTRODUCES one of these. A new `useInView` import compiles, runs,
// and quietly reopens a decision nobody remembers making — the Phase 2
// sections use `Reveal`, whose IntersectionObserver is gated on splash
// readiness, and `useInView`'s was not.
//
// The `[id]` assertion is here for the same reason in reverse: the rule's
// return would be silent, because every Phase 2 section outranks it at
// (0,1,1) and its only other anchor target sits at document position 0 where
// `scroll-margin-top` is unreachable. Silent either way is precisely when a
// test is worth having.
import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// `import.meta.url`, not `__dirname` — this file is ESM, and eslint's
// browser globals for src/** give it no `__dirname` to lean on. Vitest
// happens to supply one at runtime, so the lint error is the only signal.
// Matches revealTransition.test.js and mobile.test.js.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC  = path.resolve(HERE, '../..');
const E2E  = path.resolve(HERE, '../../../e2e');

/** Modules deleted by PF-89, with the ticket that orphaned each. */
const DELETED = [
  { file: 'hooks/useTypewriter.js',            id: 'useTypewriter',  orphanedBy: 'PF-80' },
  { file: 'hooks/useInView.js',                id: 'useInView',      orphanedBy: 'PF-85/86/87' },
  { file: 'components/common/TerminalWindow.jsx', id: 'TerminalWindow', orphanedBy: 'PF-80' },
];

function walk(dir, exts, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, exts, acc);
    else if (exts.includes(path.extname(e.name))) acc.push(p);
  }
  return acc;
}

/** Strip comments before searching. Every file below documents the very
 *  identifiers this test forbids, in prose, at the place the code used to
 *  be — so a raw-text scan matches the explanation and reports PASS. That
 *  failure shape (a test that passes while asserting nothing) is the one
 *  CLAUDE.md calls the worst possible, and it has bitten eight test files
 *  in this repo already. */
const strip = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('PF-89 cutover — deleted Phase 1 scaffolding stays deleted', () => {
  const files = [...walk(SRC, ['.js', '.jsx']), ...walk(E2E, ['.js'])];

  it('scanned a plausible number of files', () => {
    // A scanner that globs nothing reports "no offenders" in exactly the
    // same words as a clean tree. Same self-check as revealTransition's
    // ">20 pairs" assertion, and for the same reason.
    expect(files.length).toBeGreaterThan(80);
  });

  it.each(DELETED)('$file is gone (orphaned by $orphanedBy)', ({ file }) => {
    expect(fs.existsSync(path.join(SRC, file))).toBe(false);
  });

  it.each(DELETED)('nothing imports $id', ({ id }) => {
    const offenders = files.filter((f) => {
      const src = strip(fs.readFileSync(f, 'utf8'));
      // An import of the module by path, in any of the three forms this
      // codebase uses: static import, dynamic import(), and require().
      return new RegExp(
        `(from\\s*['"][^'"]*${id}['"])|(import\\s*\\(\\s*['"][^'"]*${id}['"])|(require\\s*\\(\\s*['"][^'"]*${id}['"])`,
      ).test(src);
    });
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });

  it('useTypewriter\'s test file went with the hook', () => {
    // Deleting a module and keeping its test is how dead code stays
    // looking alive. The test count going DOWN is the intended result.
    expect(fs.existsSync(path.join(SRC, 'hooks/__tests__/useTypewriter.test.js'))).toBe(false);
  });
});

describe('PF-89 cutover — the [id] scroll-margin rule stays deleted', () => {
  const global = strip(fs.readFileSync(path.join(SRC, 'styles/global.css'), 'utf8'));

  it('global.css declares no blanket [id] scroll-margin-top', () => {
    // It was `[id] { scroll-margin-top: 5rem }` — (0,1,0), an exact tie with
    // any single-class section rule, so it won on emission order and
    // computed 80px against a 71px header. Every Phase 2 section now
    // qualifies its selector as `section.x` (0,1,1) and outranks it.
    expect(global).not.toMatch(/\[id\]\s*\{[^}]*scroll-margin/);
    expect(global).not.toMatch(/scroll-margin-top:\s*5rem/);
  });

  it('the six Phase 2 sections each set their own, qualified by element', () => {
    const sections = {
      hero: 'HeroSection', about: 'AboutSection', skills: 'SkillsSection',
      projects: 'ProjectsSection', blog: 'BlogSection', contact: 'ContactSection',
    };
    for (const [id, mod] of Object.entries(sections)) {
      const css = strip(
        fs.readFileSync(path.join(SRC, `components/sections/${mod}.module.css`), 'utf8'),
      );
      // `section.hero`, not `.hero` — the qualified form is the whole fix.
      expect(css, `${mod} must qualify with the element name`)
        .toMatch(new RegExp(`section\\.${id}\\s*\\{[^}]*scroll-margin-top:\\s*var\\(--header-h\\)`));
    }
  });
});

/* ── PF-116 (2026-10-08) — the Phase 1 layer of global.css is gone ─────────
 *
 * PF-116 deleted global.css's `:root` palette, its body font/colour rules,
 * its global utility classes and its six keyframes, once PF-80 → PF-115 had
 * moved every consumer onto tokens.css. Nothing fails on its own if any of
 * it comes back, and two of the ways it could come back are SILENT:
 *
 *   - a `var(--text-muted)` written today resolves to NOTHING, so the
 *     declaration drops and the element inherits whatever is above it —
 *     usually readable, so nobody looks;
 *   - a `className="glass"` matches no rule, so the element renders
 *     unstyled with no error.
 *
 * ⚠️ Parsed or comment-stripped throughout. Every file this touches names
 * these identifiers in prose at the place they used to be.
 */
const PHASE_1_TOKENS = [
  // Copied from adminFoundation.test.js, which keeps the same list for the
  // admin stylesheets. Both are the record of names that no longer exist,
  // so neither can drift from a live source; `--bg` and `--font-mono` are
  // absent on purpose — tokens.css declares them as Phase 2 tokens too.
  '--bg-surface', '--bg-elevated',
  '--border', '--border-bright',
  '--accent', '--accent-hover', '--accent-dim', '--accent-glow',
  '--green', '--green-glow',
  '--text-primary', '--text-body', '--text-muted',
  '--font-sans',
  '--section-y', '--content-max', '--content-px',
];

/** The global classes global.css used to define. Exact names only — Tailwind
 *  has its own `animate-*` utilities (spin, ping, pulse, bounce), and none
 *  of those were Phase 1's. */
const DELETED_CLASSES = [
  'glass', 'btn-primary', 'btn-outline', 'skeleton', 'tech-tag',
  'gradient-text', 'glow-accent', 'glow-green',
  'section-wrapper', 'section-label', 'section-title', 'section-divider',
  'animate-fade-in-up', 'animate-fade-in-up-delay-1', 'animate-fade-in-up-delay-2',
  'animate-fade-in-up-delay-3', 'animate-fade-in-up-delay-4', 'animate-fade-in-up-delay-5',
  'animate-blink', 'animate-float', 'animate-pulse-glow',
  'reveal', 'revealed',
];

const notATest = (f) => !f.includes(`${path.sep}__tests__${path.sep}`) && !/\.test\.jsx?$/.test(f);

describe('PF-116 cutover — global.css is Tailwind\'s entry point and nothing else', () => {
  const root = postcss.parse(fs.readFileSync(path.join(SRC, 'styles/global.css'), 'utf8'));

  it('still carries the Tailwind entry and the @theme bridge', () => {
    // The control. Everything below is an ABSENCE assertion, and an empty
    // or unparsed file satisfies every one of them.
    const atRules = [];
    root.walkAtRules((a) => atRules.push(a.name));
    expect(atRules).toEqual(expect.arrayContaining(['import', 'source', 'theme']));
  });

  it('has no :root rule', () => {
    const selectors = [];
    root.walkRules((r) => selectors.push(...r.selectors));
    expect(selectors.filter((sel) => sel.includes(':root'))).toEqual([]);
  });

  it('declares no custom property outside the @theme bridge', () => {
    const declared = [];
    root.walkDecls((d) => { if (d.prop.startsWith('--')) declared.push(d.prop); });
    expect(declared.filter((p) => !p.startsWith('--color-'))).toEqual([]);
  });

  it('defines no @keyframes — the library lives in styles/keyframes/', () => {
    // Two of the six it carried (`blink`, `shimmer`) duplicated keyframes/
    // base.css. Identical bodies, so harmless — but a redefined keyframe of
    // the same name is decided by import order alone, and global.css loads
    // FIRST, so an edit here would be dead code with nothing to say so.
    const keyframes = [];
    root.walkAtRules('keyframes', (a) => keyframes.push(a.params));
    expect(keyframes).toEqual([]);
  });

  it('defines none of the deleted global classes', () => {
    const offenders = [];
    root.walkRules((r) => r.selectors.forEach((sel) => {
      for (const c of DELETED_CLASSES) {
        if (new RegExp(`\\.${c}(?![\\w-])`).test(sel)) offenders.push(`${sel} (${c})`);
      }
    }));
    expect(offenders).toEqual([]);
  });
});

describe('PF-116 cutover — nothing reads the deleted Phase 1 layer', () => {
  const sheets = walk(SRC, ['.css']).filter(notATest);
  const code   = walk(SRC, ['.js', '.jsx']).filter(notATest);
  const reads  = (text) => PHASE_1_TOKENS.filter(
    (t) => text.includes(`var(${t})`) || text.includes(`var(${t},`),
  );

  it('scanned a plausible number of files', () => {
    expect(sheets.length).toBeGreaterThan(30);
    expect(code.length).toBeGreaterThan(80);
  });

  it('no stylesheet reads a Phase 1 token', () => {
    const offenders = [];
    for (const f of sheets) {
      postcss.parse(fs.readFileSync(f, 'utf8')).walkDecls((d) => {
        const hit = reads(d.value);
        if (hit.length) offenders.push(`${path.relative(SRC, f)}: ${d.prop}: ${d.value}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('no JS/JSX reads a Phase 1 token — inline styles included', () => {
    // The stylesheet walk above cannot see `style={{ color: 'var(…)' }}`,
    // and that blind spot is exactly where ErrorBoundary's --text-muted
    // survived every sweep until PF-116.
    const offenders = code
      .map((f) => [path.relative(SRC, f), reads(strip(fs.readFileSync(f, 'utf8')))])
      .filter(([, hit]) => hit.length);
    expect(offenders).toEqual([]);
  });

  it('no className uses a deleted global class', () => {
    const literal = /className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*`([^`]*)`\s*\})/g;
    const offenders = [];
    let used = 0;
    for (const f of code) {
      const text = strip(fs.readFileSync(f, 'utf8'));
      for (const m of text.matchAll(literal)) {
        used += 1;
        const tokens = (m[1] ?? m[2] ?? m[3]).split(/\s+/);
        for (const t of tokens) if (DELETED_CLASSES.includes(t)) offenders.push(`${path.relative(SRC, f)}: ${t}`);
      }
    }
    // Self-check: the pattern must actually find className literals.
    expect(used).toBeGreaterThan(20);
    expect(offenders).toEqual([]);
  });

  it('no JS/JSX carries a Phase 1 red literal', () => {
    // #f87171 / #dc2626 / rgba(239,68,68,…) never flip with the theme
    // (#f87171 measured 2.48:1 on the light ground). var(--danger) does.
    const red = /#f87171|#dc2626|rgba\(\s*239\s*,\s*68\s*,\s*68/i;
    const offenders = code
      .filter((f) => red.test(strip(fs.readFileSync(f, 'utf8'))))
      .map((f) => path.relative(SRC, f));
    expect(offenders).toEqual([]);
  });
});

describe('PF-116 cutover — the body font is the prototype\'s', () => {
  const tokens = postcss.parse(fs.readFileSync(path.join(SRC, 'styles/tokens.css'), 'utf8'));
  const body = {};
  tokens.walkRules((r) => {
    if (r.selectors.includes('body')) r.walkDecls((d) => { body[d.prop] = d.value; });
  });

  it('body sets Space Grotesk through --font-body', () => {
    expect(body['font-family']).toBe('var(--font-body)');
  });

  it('body keeps line-height 1.6 (owner, 2026-10-08)', () => {
    // NOT the prototype's — its body sets none. 1.6 is what Phase 1's body
    // rule shipped, kept so inheriting text does not tighten. Without it
    // the value silently falls to Tailwind preflight's 1.5.
    expect(body['line-height']).toBe('1.6');
  });

  it('no stylesheet names Inter, and index.html no longer downloads it', () => {
    const named = walk(SRC, ['.css']).filter(notATest).filter((f) => {
      let hit = false;
      postcss.parse(fs.readFileSync(f, 'utf8')).walkDecls((d) => {
        if (/font/.test(d.prop) && /\bInter\b/.test(d.value)) hit = true;
      });
      return hit;
    });
    expect(named.map((f) => path.relative(SRC, f))).toEqual([]);

    const html = fs.readFileSync(path.resolve(SRC, '../index.html'), 'utf8');
    expect(html).toMatch(/fonts\.googleapis\.com\/css2\?family=Anton/); // control
    expect(html).not.toMatch(/family=Inter/);
  });
});
