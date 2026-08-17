// frontend/src/styles/__tests__/animations.test.js
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, '../..');

const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Every @keyframes name defined anywhere in the global keyframe library. */
const keyframeNames = () => {
  const dir = resolve(SRC, 'styles/keyframes');
  const names = new Set();
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.css'))) {
    const css = strip(readFileSync(join(dir, f), 'utf8'));
    for (const [, name] of css.matchAll(/@keyframes\s+([A-Za-z0-9_-]+)/g)) names.add(name);
  }
  return names;
};

/** Every `.kf-*` carrier class in animations.css → the name it sets. */
const carriers = () => {
  const css = strip(readFileSync(resolve(SRC, 'styles/animations.css'), 'utf8'));
  const map = new Map();
  for (const [, cls, name] of css.matchAll(
    /\.(kf-[A-Za-z0-9_-]+)\s*\{\s*animation-name:\s*([A-Za-z0-9_-]+)\s*;?\s*\}/g,
  )) {
    map.set(cls, name);
  }
  return map;
};

/** Recursively collect every *.module.css under src/. */
const moduleFiles = (dir = SRC, acc = []) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) moduleFiles(full, acc);
    else if (entry.endsWith('.module.css')) acc.push(full);
  }
  return acc;
};

const KEYWORDS = new Set(['none', 'initial', 'inherit', 'unset', 'revert']);

describe('global keyframe references from CSS Modules', () => {
  it('every .kf-* carrier points at a keyframe that actually exists', () => {
    const defined = keyframeNames();
    for (const [cls, name] of carriers()) {
      expect(defined, `${cls} references @keyframes ${name}, which is not defined`).toContain(name);
    }
  });

  it('no *.module.css names a keyframe directly', () => {
    // THE BUG THIS GUARDS.
    //
    // CSS Modules scopes @keyframes names and rewrites the name inside
    // an `animation` / `animation-name` declaration to match. The
    // library lives in styles/keyframes/*.css, which are NOT modules,
    // so their names stay global — and a module writing
    //
    //     animation: pulsering 6s ease-in-out infinite;
    //
    // compiles to `animation-name: Splash-module__pulsering`, which no
    // @keyframes defines. The element then silently does not animate.
    // getComputedStyle still reports it as "running"; only
    // element.getAnimations().length === 0 reveals it.
    //
    // It cost all 14 splash animations, the navbar CONTACT pill and the
    // Marquee simultaneously, and none of it produced an error.
    //
    // Use `composes: kf-<name> from global` plus the animation
    // LONGHANDS instead — see styles/animations.css.
    const offenders = [];

    for (const file of moduleFiles()) {
      const css = strip(readFileSync(file, 'utf8'));

      for (const [, value] of css.matchAll(/animation-name:\s*([^;}]+)/g)) {
        const name = value.trim();
        if (!KEYWORDS.has(name)) offenders.push(`${relative(SRC, file)}  animation-name: ${name}`);
      }

      // The `animation` shorthand: flag any bare identifier that is not
      // a keyword, a time, a number, or a function like cubic-bezier().
      for (const [, value] of css.matchAll(/(?<!-)\banimation:\s*([^;}]+)/g)) {
        const tokens = value
          .replace(/[a-z-]+\([^)]*\)/gi, ' ') // drop cubic-bezier(...), steps(...)
          .split(/[\s,]+/)
          .filter(Boolean);
        for (const t of tokens) {
          const isTime = /^-?[\d.]+m?s$/.test(t);
          const isNumber = /^[\d.]+$/.test(t);
          const isKnown = /^(normal|reverse|alternate|alternate-reverse|none|forwards|backwards|both|infinite|running|paused|linear|ease|ease-in|ease-out|ease-in-out|step-start|step-end|initial|inherit|unset|revert)$/.test(t);
          if (!isTime && !isNumber && !isKnown) {
            offenders.push(`${relative(SRC, file)}  animation: … ${t} …`);
          }
        }
      }
    }

    expect(
      offenders,
      `These declare a keyframe name inside a CSS Module, which compiles to a scoped name no @keyframes defines — the element will silently not animate:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('every `composes: kf-… from global` resolves to a real carrier', () => {
    const known = carriers();
    const missing = [];

    for (const file of moduleFiles()) {
      const css = strip(readFileSync(file, 'utf8'));
      for (const [, cls] of css.matchAll(/composes:\s*(kf-[A-Za-z0-9_-]+)\s+from\s+global/g)) {
        if (!known.has(cls)) missing.push(`${relative(SRC, file)} → ${cls}`);
      }
    }

    expect(missing, `Composed carriers not defined in animations.css:\n${missing.join('\n')}`).toEqual([]);
  });

  it('animations.css is imported after the keyframe library', () => {
    // The carriers only set animation-name; the @keyframes they point at
    // must already be in the sheet. Order also keeps motion.css last, so
    // reduced motion still wins over both.
    const main = readFileSync(resolve(SRC, 'main.jsx'), 'utf8');
    const at = (s) => main.indexOf(s);
    expect(at('./styles/keyframes/index.css')).toBeGreaterThan(-1);
    expect(at('./styles/animations.css')).toBeGreaterThan(at('./styles/keyframes/index.css'));
    expect(at('./styles/motion.css')).toBeGreaterThan(at('./styles/animations.css'));
  });
});
