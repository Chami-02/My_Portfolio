// frontend/src/styles/__tests__/mediaOrder.test.js
//
// PF-142 — a @media override that a LATER base rule silently cancels.
//
// A media query adds no specificity. So when a sheet says
//
//     @media (max-width: 899px) { .status { justify-self: start } }
//     …
//     .status { justify-self: end }
//
// the second rule wins on a phone too, and the override does nothing — no
// error, no warning. Footer.module.css carried four such dead declarations
// from the 2026-08 mobile pass until PF-142 (the owner saw the STATUS card
// "off-centre"). mobile.test.js did not catch it: it reads what a @media
// block DECLARES, not what the cascade APPLIES.
//
// The rule pinned here: for every declaration inside any @media block, no
// top-level rule with the same selector and property may come after the
// block. Every sheet under src/, walked — a new one is covered on arrival.
// Parsed with postcss, never searched as text.
import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import { it, expect } from 'vitest';
import postcss from 'postcss';

const src = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const sheets = [];
(function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.name.endsWith('.css')) sheets.push(path);
  }
})(src);

/** Every "selector | property" a @media block sets, with the block's start line. */
function deadOverrides(css) {
  const root = postcss.parse(css);
  const base = [];
  root.walkRules((rule) => {
    if (rule.parent.type !== 'root') return;
    for (const sel of rule.selectors) {
      rule.walkDecls((d) => base.push({ key: `${sel.trim()} | ${d.prop}`, line: rule.source.start.line }));
    }
  });
  const dead = [];
  root.walkAtRules('media', (at) => {
    at.walkRules((rule) => {
      for (const sel of rule.selectors) {
        rule.walkDecls((d) => {
          const key = `${sel.trim()} | ${d.prop}`;
          const later = base.find((b) => b.key === key && b.line > at.source.start.line);
          if (later) dead.push(`@media ${at.params} ${key} — cancelled by line ${later.line}`);
        });
      }
    });
  });
  return dead;
}

it('finds the sheets (a guard that walks nothing proves nothing)', () => {
  expect(sheets.length).toBeGreaterThan(30);
  expect(sheets.map((p) => relative(src, p))).toContain('components/layout/Footer.module.css');
});

it('the check itself catches the trap', () => {
  const css = '@media (max-width: 899px) { .status { justify-self: start } }\n.status { justify-self: end }';
  expect(deadOverrides(css)).toEqual(['@media (max-width: 899px) .status | justify-self — cancelled by line 2']);
  expect(deadOverrides('.status { justify-self: end }\n@media (max-width: 899px) { .status { justify-self: start } }')).toEqual([]);
});

it('no @media declaration in any sheet is cancelled by a later base rule', () => {
  const found = sheets.flatMap((p) => deadOverrides(readFileSync(p, 'utf8')).map((d) => `${relative(src, p)}: ${d}`));
  expect(found).toEqual([]);
});
