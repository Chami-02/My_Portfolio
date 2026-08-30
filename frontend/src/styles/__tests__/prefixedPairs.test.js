// frontend/src/styles/__tests__/prefixedPairs.test.js
//
// PF-90 — when a rule declares BOTH the `-webkit-` and the standard
// spelling of a property, the prefixed one MUST come first. Getting it
// wrong fails SILENTLY, and the source stays correct-looking throughout.
//
// esbuild's CSS minifier (Vite's default `cssMinify`; this repo sets no
// browserslist) treats the two spellings as the same declaration and
// keeps only the LAST one in the rule. So this source:
//
//     backdrop-filter: blur(16px);
//     -webkit-backdrop-filter: blur(16px);
//
// shipped as `-webkit-backdrop-filter` ONLY — and Chrome has dropped the
// prefixed alias, so the blur did not render at all. Measured on the
// production build: the header and the mobile nav overlay both shipped
// webkit-only, while `getComputedStyle(el).backdropFilter` read `none`
// with the rule plainly present in the stylesheet.
//
// ⚠️ `CSS.supports()` proves NOTHING here — it returned `true` for
// `backdrop-filter: blur(16px)` in the same browser that computed the
// property to `none`. Only a rendered control distinguishes them.
//
// Writing `-webkit-` FIRST and the standard property LAST keeps both.
// `ScrollToTop.module.css` and `HeroSection.module.css`'s mask pair
// survived the original bug purely because they already did this.
//
// ⚠️ Parsed with postcss, never a raw text search: the rules this guards
// are documented in prose directly above themselves, and those comments
// contain the exact property names being asserted. A
// `toContain('backdrop-filter')` here matches the comment explaining the
// rule. Comments are a distinct node type a declaration walk never
// visits — see the raw-text-matching-a-comment entry in CLAUDE.md.
//
// Cross-cutting guard, so it lives in styles/__tests__/ per the
// revealTransition / mobile / cutover precedent.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

// import.meta.url, not __dirname: eslint gives src/** browser globals,
// where ESM has no __dirname. It passes under Vitest and fails lint.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '../..');

function cssFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) cssFiles(full, acc);
    else if (entry.name.endsWith('.css')) acc.push(full);
  }
  return acc;
}

/**
 * Every rule that declares a property in BOTH spellings, with the
 * declaration order preserved.
 */
function pairedRules() {
  const found = [];
  for (const file of cssFiles(SRC)) {
    const root = postcss.parse(fs.readFileSync(file, 'utf8'));
    root.walkRules((rule) => {
      const order = [];
      rule.walkDecls((d) => order.push(d.prop));

      const prefixed = order.filter((p) => p.startsWith('-webkit-'));
      for (const pre of new Set(prefixed)) {
        const bare = pre.replace(/^-webkit-/, '');
        if (!order.includes(bare)) continue; // prefix-only: no pair, fine
        found.push({
          file: path.relative(SRC, file),
          selector: rule.selector,
          property: bare,
          prefixedIndex: order.indexOf(pre),
          standardIndex: order.indexOf(bare),
        });
      }
    });
  }
  return found;
}

/** Every rule declaring backdrop-filter in either spelling. */
function backdropRules() {
  const found = [];
  for (const file of cssFiles(SRC)) {
    const root = postcss.parse(fs.readFileSync(file, 'utf8'));
    root.walkRules((rule) => {
      const decls = [];
      rule.walkDecls((d) => {
        if (d.prop === 'backdrop-filter' || d.prop === '-webkit-backdrop-filter') {
          decls.push({ prop: d.prop, value: d.value });
        }
      });
      if (decls.length) found.push({ file: path.relative(SRC, file), selector: rule.selector, decls });
    });
  }
  return found;
}

describe('prefixed/standard property pairs (PF-90)', () => {
  const pairs = pairedRules();

  it('scanned a meaningful number of pairs', () => {
    // A scanner that globs nothing reports "no offenders" in exactly the
    // same words as a clean tree. Same self-check as revealTransition's
    // ">20 pairs" and cutover's ">80 files".
    expect(pairs.length).toBeGreaterThanOrEqual(4);
  });

  it('declares -webkit- BEFORE the standard property, in every pair', () => {
    const wrongOrder = pairs
      .filter((p) => p.prefixedIndex > p.standardIndex)
      .map((p) => `${p.file} {${p.selector}} ${p.property}`);

    expect(
      wrongOrder,
      'standard-before-webkit is collapsed to webkit-only by esbuild minification',
    ).toEqual([]);
  });
});

describe('backdrop-filter specifically (PF-90)', () => {
  const rules = backdropRules();

  it('found the known backdrop-filter rules', () => {
    expect(rules.length).toBeGreaterThanOrEqual(4);
  });

  it('every rule declaring backdrop-filter also declares the standard property', () => {
    // webkit-only renders NO blur in Chrome — verified with a rendered
    // three-panel control, not a support query.
    const webkitOnly = rules
      .filter((r) => !r.decls.some((d) => d.prop === 'backdrop-filter'))
      .map((r) => `${r.file} {${r.selector}}`);
    expect(webkitOnly).toEqual([]);
  });

  it('pairs declare the same blur value in both spellings', () => {
    const mismatched = rules
      .filter((r) => r.decls.length > 1)
      .filter((r) => new Set(r.decls.map((d) => d.value)).size !== 1)
      .map((r) => `${r.file} {${r.selector}}: ${r.decls.map((d) => d.value).join(' vs ')}`);
    expect(mismatched).toEqual([]);
  });
});
