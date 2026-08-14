// frontend/src/styles/__tests__/keyframes.test.js
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const dir  = resolve(here, '../keyframes');

const read = (f) => readFileSync(resolve(dir, f), 'utf8')
  // FIX 1 — strip comments before matching. PF-67 hit this: a prose
  // example inside a header comment was read as a real declaration.
  .replace(/\/\*[\s\S]*?\*\//g, '');

const base      = read('base.css');
const portfolio = read('portfolio.css');
const blog      = read('blog.css');
const admin     = read('admin.css');
// FIX 3 — join with a newline, not bare `+`. Concatenating files
// directly glues one file's closing `}` onto the next file's first
// `@keyframes` line with no line break between them, which silently
// breaks the ^-anchored regex below (flt-blog / flt-admin failed
// this way — each is the first declaration in its file).
const all       = [base, portfolio, blog, admin].join('\n');
const screens   = [portfolio, blog, admin].join('\n');

const BASE = [
  'riseIn', 'fadeIn', 'typeIn', 'barGrow',
  'dot', 'glowdot', 'glowpulse', 'pulsering', 'ringPulse', 'boltp',
  'breathe', 'floatY', 'nudge', 'spin', 'orbdot',
  'sweep', 'shimmerline', 'shimmer',
  'scanline', 'flicker', 'marq', 'blink',
];

const VARIANTS = [
  'flt-portfolio', 'drift-portfolio', 'sheen-portfolio',
  'flt-blog', 'sheen-blog',
  'flt-admin', 'drift-admin', 'sheen-admin',
  'auroraA', 'auroraB',
];

// FIX 2 — anchor to line start with the m flag, so a mention in
// prose can't satisfy the match.
const defines = (css, name) =>
  new RegExp(`^\\s*@keyframes\\s+${name}\\s*\\{`, 'm').test(css);

describe('Keyframe library (PF-69)', () => {

  it.each(BASE)('base defines @keyframes %s', (name) => {
    expect(defines(base, name)).toBe(true);
  });

  it.each(VARIANTS)('a screen file defines @keyframes %s', (name) => {
    expect(defines(screens, name)).toBe(true);
  });

  it('defines 32 keyframes in total', () => {
    const found = [...all.matchAll(/@keyframes\s+([a-zA-Z0-9_-]+)/g)].map(m => m[1]);
    expect(found).toHaveLength(BASE.length + VARIANTS.length);
  });

  it('defines no keyframe name twice', () => {
    const found = [...all.matchAll(/@keyframes\s+([a-zA-Z0-9_-]+)/g)].map(m => m[1]);
    const dupes = found.filter((n, i) => found.indexOf(n) !== i);
    expect(dupes).toEqual([]);
  });

  // Values that carry the design's feel. Rounding them is the
  // failure mode this ticket exists to prevent.
  it('preserves exact magnitudes', () => {
    expect(base).toMatch(/scale\(1\.28\)/);           // glowdot
    expect(base).toMatch(/scale\(1\.06\)/);           // pulsering
    expect(base).toMatch(/translateY\(-50%\)|translateX\(-50%\)/); // marq
    expect(portfolio).toMatch(/translateY\(-14px\)/);
    expect(blog).toMatch(/translateY\(-12px\)/);
    expect(admin).toMatch(/translateY\(-16px\)/);
  });

  it('keeps the three flt variants distinct', () => {
    expect(portfolio).toMatch(/-14px/);
    expect(blog).toMatch(/-12px/);
    expect(admin).toMatch(/-16px/);
  });

  it('keeps translate3d on drift and aurora for GPU compositing', () => {
    expect(portfolio).toMatch(/translate3d/);
    expect(admin).toMatch(/translate3d/);
  });

  it('keeps the orbdot counter-rotation', () => {
    const block = base.slice(base.indexOf('@keyframes orbdot'));
    expect(block.slice(0, 300)).toMatch(/rotate\(-360deg\)/);
  });

});
