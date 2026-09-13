// frontend/src/styles/__tests__/adminFoundation.test.js
//
// PF-107. The structural guards behind the admin design foundations.
//
// ⚠️ Cross-cutting on purpose, and it breaks the per-module __tests__
// convention deliberately — it belongs to no single module. Same
// precedent as revealTransition.test.js (PF-93), mobile.test.js (PF-88)
// and cutover.test.js. This is the fourth.
//
// What it protects, and why each one matters beyond this ticket:
//
//   1. The copy-pasted INPUT/LABEL constants stay deleted. Five files
//      carried them, four had silently drifted apart, and one was
//      re-allocated on every render.
//   2. The three new stylesheets never reach for a Phase 1 token. This
//      is the gate PF-116 depends on: global.css's :root can only be
//      deleted once nothing reads it, and admin is the last consumer.
//   3. The shared .input keeps a real focus indicator. Every constant
//      it replaced carried `outline: none` with nothing put back.
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import postcss from 'postcss';

const here = dirname(fileURLToPath(import.meta.url));
const src  = resolve(here, '../..');

const read = (p) => readFileSync(p, 'utf8');

// JS/JSX comments only. CSS is handled by postcss below, which never
// visits a comment node at all.
const stripJs = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/* ── 1. The copy-pasted style constants stay gone ─────────────────── */

describe('no admin file re-introduces a local style constant', () => {
  const files = [
    ...walk(resolve(src, 'components/admin')),
    resolve(src, 'pages/AdminLoginPage.jsx'),
    resolve(src, 'pages/AdminPage.jsx'),
  ].filter((f) => f.endsWith('.jsx') && !f.includes('__tests__'));

  it('scanned the admin tree at all', () => {
    // ⚠️ A scanner that globs nothing reports "no offenders" in exactly
    // the same words as a clean tree. Without this the whole describe
    // block below passes if the path is ever wrong.
    expect(files.length).toBeGreaterThanOrEqual(9);
  });

  it.each([
    ['INPUT'],
    ['LABEL'],
    ['SELECT'],
    ['FI'],
    ['FocusInput'],
  ])('declares no `%s` style constant anywhere', (name) => {
    const re = new RegExp(`\\bconst\\s+${name}\\s*=\\s*\\{`);
    const offenders = files
      .filter((f) => re.test(stripJs(read(f))))
      .map((f) => relative(src, f));

    expect(offenders).toEqual([]);
  });

  it('no longer pokes element.style to paint a field focus ring', () => {
    // The 16 onFocus/onBlur handlers these replaced were CSS wearing a
    // JavaScript costume. Button hover handlers are NOT covered here —
    // those belong to the panel tickets, so a blanket ban would fail
    // for work this ticket deliberately did not do.
    const offenders = files
      .filter((f) => /onFocus=\{[^}]*\.style\./.test(stripJs(read(f))))
      .map((f) => relative(src, f));

    expect(offenders).toEqual([]);
  });
});

/* ── 2. The new stylesheets are Phase-1-free ──────────────────────── */

// Every custom property declared in global.css's :root. PF-116 deletes
// that block; anything below reading one of these names blocks it.
const PHASE_1_TOKENS = [
  '--bg-surface', '--bg-elevated',
  '--border', '--border-bright',
  '--accent', '--accent-hover', '--accent-dim', '--accent-glow',
  '--green', '--green-glow',
  '--text-primary', '--text-body', '--text-muted',
  '--font-sans',
  '--section-y', '--content-max', '--content-px',
];

const PHASE_2_SHEETS = [
  'styles/admin.module.css',
  'components/admin/AdminLayout.module.css',
  'components/admin/AdminFooter.module.css',
];

describe("PF-107's stylesheets read no Phase 1 token", () => {
  // ⚠️ postcss, NOT a raw-text search, and this file is a live example
  // of why. admin.module.css's own header comment NAMES seven of the
  // tokens below, in the prose explaining that they are banned. A
  // regex over the file text would flag that comment as an offence —
  // the same trap that has produced FALSE NEGATIVES eight times in
  // this repo, running in the opposite direction for once. A
  // declaration walk never visits a comment node.
  const valuesOf = (file) => {
    const values = [];
    postcss.parse(read(resolve(src, file))).walkDecls((d) => {
      values.push(`${d.prop}: ${d.value}`);
    });
    return values;
  };

  it.each(PHASE_2_SHEETS)('%s declares something at all', (file) => {
    expect(valuesOf(file).length).toBeGreaterThan(20);
  });

  it.each(PHASE_2_SHEETS)('%s names no Phase 1 token', (file) => {
    const hits = valuesOf(file).filter((decl) =>
      PHASE_1_TOKENS.some((t) => decl.includes(`var(${t})`) || decl.includes(`var(${t},`)),
    );
    expect(hits).toEqual([]);
  });

  it('the token list itself is not stale', () => {
    // If a Phase 1 token is renamed in global.css, the list above stops
    // covering it and every assertion here quietly weakens. Pin the
    // list against the real :root block rather than trusting a copy.
    const root = read(resolve(src, 'styles/global.css'));
    const block = root.slice(root.indexOf('\n:root {'), root.indexOf('}', root.indexOf('\n:root {')));
    const declared = [];
    postcss.parse(`:root {${block.split('{')[1]}}`).walkDecls((d) => declared.push(d.prop));

    // --bg and --font-mono are declared in BOTH layers; tokens.css wins
    // on import order, so reading them is not a Phase 1 dependency.
    const phase1Only = declared.filter((p) => p !== '--bg' && p !== '--font-mono');
    expect([...phase1Only].sort()).toEqual([...PHASE_1_TOKENS].sort());
  });
});

/* ── 3. The shared field keeps a focus indicator ──────────────────── */

describe('admin.module.css — focus handling', () => {
  const sheet = read(resolve(src, 'styles/admin.module.css'));

  const rules = () => {
    const out = [];
    postcss.parse(sheet).walkRules((rule) => {
      const decls = {};
      rule.walkDecls((d) => { decls[d.prop] = d.value; });
      out.push({ selector: rule.selector, decls });
    });
    return out;
  };

  it('parsed some rules', () => {
    expect(rules().length).toBeGreaterThan(20);
  });

  it('suppresses no outline anywhere', () => {
    // `main[tabindex="-1"]:focus` in tokens.css is the repo's one
    // sanctioned `outline: none`, and its justification is that a
    // keyboard cannot OPERATE the element. Every control here can.
    const offenders = rules()
      .filter((r) => (r.decls.outline || '').trim() === 'none')
      .map((r) => r.selector);
    expect(offenders).toEqual([]);
  });

  it('gives .input a visible focus border and a forced-colors outline', () => {
    const focusVisible = rules().find((r) => r.selector === '.input:focus-visible');
    expect(focusVisible).toBeDefined();
    expect(focusVisible.decls['border-color']).toMatch(/var\(--acc/);
    // A TRANSPARENT outline, not a suppressed one: it renders as
    // nothing normally, and forced-colors mode restores it to a system
    // colour — which is the only indicator left there once the browser
    // overrides the author border-color above.
    expect(focusVisible.decls.outline).toMatch(/transparent/);
  });

  it('declares no border-radius inside a focus rule', () => {
    // A radius in a :focus/:focus-visible rule reshapes the ELEMENT
    // while focused rather than the ring — it squares off a 999px pill
    // for exactly as long as focus is on it.
    const offenders = rules()
      .filter((r) => /:focus/.test(r.selector) && 'border-radius' in r.decls)
      .map((r) => r.selector);
    expect(offenders).toEqual([]);
  });
});
