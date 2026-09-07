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

/**
 * ⚠️ KEYFRAMES THIS PROJECT ADDED THAT THE PROTOTYPE DOES NOT HAVE.
 *
 * Kept as a THIRD list rather than folded into BASE so the 32-count
 * assertion below keeps meaning what it meant: BASE + VARIANTS is still
 * exactly the design's own set, and this list is the explicit, reviewed
 * exception budget. Growing BASE instead would have let the next
 * addition hide inside a number nobody reads.
 */
const ADDITIONS = [
  'dot-ok',   // owner-requested 2026-08-29 — the LIVE SITE green dot
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

  it.each(ADDITIONS)('base defines the added @keyframes %s', (name) => {
    expect(defines(base, name)).toBe(true);
  });

  it('defines the prototype\'s 32 keyframes plus exactly the listed additions', () => {
    const found = [...all.matchAll(/@keyframes\s+([a-zA-Z0-9_-]+)/g)].map(m => m[1]);

    // The design's own set is still 32 and still asserted as such.
    expect(BASE.length + VARIANTS.length).toBe(32);

    // Anything defined that is in none of the three lists is drift.
    const known = new Set([...BASE, ...VARIANTS, ...ADDITIONS]);
    expect(found.filter((n) => !known.has(n))).toEqual([]);
    expect(found).toHaveLength(BASE.length + VARIANTS.length + ADDITIONS.length);
  });

  it('defines no keyframe name twice', () => {
    const found = [...all.matchAll(/@keyframes\s+([a-zA-Z0-9_-]+)/g)].map(m => m[1]);
    const dupes = found.filter((n, i) => found.indexOf(n) !== i);
    expect(dupes).toEqual([]);
  });

  /**
   * ⚠️ WHICH PROPERTY EACH KEYFRAME ANIMATES — added PF-101, 2026-09-07.
   *
   * The list above pins NAMES. That is what let `sweep` ship for a full
   * sprint as a `transform` when both prototypes declare it as a
   * `background-position` animation: the name was right, the body was
   * wrong, and the sheen never painted on any of its three consumers.
   * Every other keyframe in the library had the identical exposure.
   *
   * ⚠️ THIS PINS THE PROPERTY, NOT THE VALUES, and that is deliberate.
   * Several magnitudes here are owner-approved deviations from the
   * prototype; asserting whole bodies would turn any future re-tune into
   * a test failure and train the next person to weaken the guard. The
   * exact magnitudes that matter already have their own assertion below.
   *
   * ⚠️ The property is what carries the MECHANISM. A wrong value looks
   * wrong on screen; a wrong property renders nothing at all and reports
   * as healthy — `getComputedStyle` says "running", and even
   * `getAnimations().length` says 1, because the wrong animation really
   * is running. That is the class of bug this catches and a value guard
   * cannot.
   *
   * `shimmer` is the built-in control: it is the one other
   * background-position keyframe, transcribed correctly, and base.css's
   * comment on it already drew the distinction `sweep` violated. If a
   * mutation of `shimmer` does not turn this red, the guard is broken.
   */
  const ANIMATES = {
    // base.css
    riseIn:      ['opacity', 'transform'],
    fadeIn:      ['opacity'],
    typeIn:      ['opacity', 'transform'],
    barGrow:     ['transform'],
    dot:         ['box-shadow'],
    'dot-ok':    ['box-shadow'],
    glowdot:     ['box-shadow', 'transform'],
    glowpulse:   ['box-shadow'],
    pulsering:   ['opacity', 'transform'],
    ringPulse:   ['box-shadow'],
    boltp:       ['opacity', 'transform'],
    breathe:     ['transform'],
    floatY:      ['transform'],
    nudge:       ['opacity', 'transform'],
    spin:        ['transform'],
    orbdot:      ['transform'],
    sweep:       ['background-position'],   // ⚠️ NOT transform — see above
    shimmerline: ['transform'],
    shimmer:     ['background-position'],
    scanline:    ['transform'],
    flicker:     ['opacity'],
    marq:        ['transform'],
    blink:       ['opacity'],
    // the per-screen variants
    'flt-portfolio':   ['transform'],
    'drift-portfolio': ['transform'],
    'sheen-portfolio': ['opacity', 'transform'],
    'flt-blog':        ['transform'],
    'sheen-blog':      ['transform'],
    'flt-admin':       ['transform'],
    'drift-admin':     ['transform'],
    'sheen-admin':     ['transform'],
    auroraA:           ['transform'],
    auroraB:           ['transform'],
  };

  /**
   * The body of one @keyframes rule, from its own opening line to its own
   * closing brace at column 0.
   *
   * ⚠️ `indexOf('}')` would stop at the first INNER step's brace and
   * silently assert against a single keyframe step — the trap already
   * documented on the `blink` assertion below, which is where this
   * technique comes from.
   */
  const bodyOf = (css, name) => {
    const start = css.search(new RegExp(`^\\s*@keyframes\\s+${name}\\s*\\{`, 'm'));
    if (start === -1) return null;
    const lines = css.slice(start).split('\n');
    const end = lines.findIndex((l, i) => i > 0 && /^\}/.test(l));
    return end === -1 ? null : lines.slice(0, end + 1).join('\n');
  };

  it('covers every defined keyframe — the table cannot silently fall behind', () => {
    const found = [...all.matchAll(/@keyframes\s+([a-zA-Z0-9_-]+)/g)].map((m) => m[1]);
    // A new keyframe with no entry here would otherwise be unguarded, and
    // nothing else in this file would notice.
    expect(found.filter((n) => !(n in ANIMATES))).toEqual([]);
    expect(Object.keys(ANIMATES)).toHaveLength(found.length);
  });

  it.each(Object.entries(ANIMATES))(
    '@keyframes %s animates exactly %s',
    (name, props) => {
      const body = bodyOf(all, name);
      expect(body, `no body found for @keyframes ${name}`).not.toBeNull();

      // Property names as they appear at the start of a declaration.
      const declared = [
        ...new Set(
          [...body.matchAll(/(?:\{|;)\s*([a-z-]+)\s*:/g)].map((m) => m[1]),
        ),
      ].sort();

      expect(declared).toEqual([...props].sort());
    },
  );

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

  /**
   * PF-85 corrected this to the prototype's own form (line 29).
   *
   * It used to read `0%,100%{opacity:1} 50%{opacity:0}`. Under
   * `step-end` — the only way the prototype and PF-85's terminal caret
   * use it — the two are identical: step-end holds each keyframe's value
   * across the interval starting at it, so both give opacity 1 across
   * [0,50) and 0 across [50,100).
   *
   * They diverge under any INTERPOLATING timing function. With `linear`
   * the prototype's form holds 1 until 49% then snaps across one
   * percent, while the old one cross-faded over both halves. `blink` is
   * a shared library keyframe, so the next consumer may not pass
   * step-end — this pins the form rather than the equivalence.
   */
  it('defines blink in the prototype form, not the normalised one', () => {
    const block = base.slice(base.indexOf('@keyframes blink'));
    // Take whole lines up to the rule's own closing brace at column 0.
    // `indexOf('}')` would stop at the first INNER block's brace and
    // silently assert against only the first keyframe step.
    const lines = block.split('\n');
    const body  = lines.slice(0, lines.indexOf('}') + 1).join('\n');
    expect(body).toMatch(/0%,\s*49%\s*\{\s*opacity:\s*1/);
    expect(body).toMatch(/50%,\s*100%\s*\{\s*opacity:\s*0/);
    // The normalised shape must not come back. Line-anchored: an
    // unanchored /0%,\s*100%/ matches the "0%, 100%" sitting INSIDE
    // "50%, 100%" and fails against the correct file — the same
    // anchoring lesson as FIX 2 at the top of this file.
    expect(body).not.toMatch(/^\s*0%,\s*100%/m);
  });

});
