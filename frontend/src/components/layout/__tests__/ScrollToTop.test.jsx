// frontend/src/components/layout/__tests__/ScrollToTop.test.jsx
//
// 2026-08-25. The button was Phase 1's, styled inline with Phase 1
// tokens — and global.css's :root is a SINGLE DARK PALETTE that never
// flips, so in light theme it floated dark surfaces and Phase 1's indigo
// over warm paper. Nothing errored; it simply never followed the theme,
// which is why it survived every previous pass.
//
// ⚠️ CSS Modules are stubbed under Vitest (document.styleSheets is
// empty), so the styling half is asserted against the stylesheet as
// TEXT — through postcss, never a raw search, because the module
// explains the Phase 1 tokens by name in prose exactly where the rule
// that replaced them lives.
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postcss from 'postcss';

import { ScrollToTop } from '../ScrollToTop';

const css = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../ScrollToTop.module.css'),
  'utf8',
);

/** Every declaration in the module, as { prop, value }[]. */
function allDecls() {
  const out = [];
  postcss.parse(css).walkRules((rule) =>
    rule.walkDecls((d) => out.push({ prop: d.prop, value: d.value })));
  return out;
}

const scrollTo = (y) => {
  Object.defineProperty(window, 'scrollY', { value: y, writable: true, configurable: true });
  act(() => { window.dispatchEvent(new Event('scroll')); });
};

const stubMotion = (reduced) =>
  vi.stubGlobal('matchMedia', vi.fn((q) => ({
    matches: reduced && q === '(prefers-reduced-motion: reduce)',
    addEventListener: () => {},
    removeEventListener: () => {},
  })));

describe('ScrollToTop', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    scrollTo(0);
  });

  it('appears only past 400px of scroll', () => {
    render(<ScrollToTop />);
    expect(screen.queryByRole('button', { name: 'Scroll to top' })).toBeNull();
    scrollTo(500);
    expect(screen.getByRole('button', { name: 'Scroll to top' })).toBeInTheDocument();
    scrollTo(100);
    expect(screen.queryByRole('button', { name: 'Scroll to top' })).toBeNull();
  });

  /* ── the owner-requested fix ─────────────────────────────────────── */

  it('uses no Phase 1 token, in any declaration', () => {
    // These five are global.css's, and none of them flips with the
    // theme. Any one of them here reproduces the exact bug this rewrite
    // fixed, and reproduces it invisibly in dark theme — which is where
    // it gets reviewed.
    const phase1 = [
      '--bg-elevated', '--border-bright', '--accent-glow',
      '--accent', '--text-primary', '--bg-surface',
    ];
    for (const { prop, value } of allDecls()) {
      for (const token of phase1) {
        // `--accent` is a prefix of `--accent-glow`, so match the whole
        // custom-property name rather than a substring.
        expect(value, `${prop}: ${value}`)
          .not.toMatch(new RegExp(`${token}(?![\\w-])`));
      }
    }
  });

  it('takes its colours from Phase 2 tokens that do flip', () => {
    const values = allDecls().map((d) => d.value).join(' ');
    expect(values).toMatch(/var\(--muted\)/);
    expect(values).toMatch(/var\(--acc/);
    expect(values).toMatch(/rgba\(var\(--srf\)/);
    expect(values).toMatch(/rgba\(var\(--ln\)/);
  });

  it('reaches its entrance keyframe through the global carrier', () => {
    // A keyframe name written inside a *.module.css is scoped to an
    // identifier no @keyframes defines, and the element then silently
    // does not animate.
    const composed = [];
    postcss.parse(css).walkDecls('composes', (d) => composed.push(d.value));
    expect(composed).toContain('kf-riseIn from global');

    for (const { prop, value } of allDecls()) {
      expect(prop, `animation shorthand resets the composed name: ${value}`)
        .not.toBe('animation');
      expect(prop).not.toBe('animation-name');
    }
  });

  it('declares no fill-mode, so the finished entrance leaves getAnimations()', () => {
    // ⚠️ Phase 1 used `both`, which keeps a FINISHED animation in the
    // list for the life of the page — the single entry PF-83's
    // reduced-motion audit had to explain away. Without a fill the
    // browser drops it on completion. The animation runs forwards to the
    // element's own resting state, so there is nothing for a fill to
    // hold.
    const props = allDecls().map((d) => d.prop);
    expect(props).not.toContain('animation-fill-mode');
  });

  it('scopes the glow to BOTH themes, and declares none outside them', () => {
    // ⚠️ THE TRAP THIS GUARDS. --acc is amber #FCA311 in dark and BROWN
    // #7E4800 in light, so one unscoped `box-shadow` behind the button
    // paints a brown smudge on light paper — valid CSS, no error, reads
    // as a rendering artefact. Same shape that forced the terminal caret
    // to a literal hex and that ThemeToggle's sun glow is scoped
    // against. Found by mutation: unscoping the dark rule passed every
    // other test in this file.
    const themed = { dark: [], light: [], unscoped: [] };
    postcss.parse(css).walkRules((rule) => {
      const shadows = [];
      rule.walkDecls('box-shadow', (d) => shadows.push(d.value));
      if (!shadows.length) return;
      if (rule.selector.includes("data-theme='dark'")) themed.dark.push(...shadows);
      else if (rule.selector.includes("data-theme='light'")) themed.light.push(...shadows);
      else themed.unscoped.push(rule.selector);
    });

    expect(themed.unscoped).toEqual([]);
    // A rest shadow AND a hover shadow in each theme. Asserting only
    // "at least one" passed with the whole light REST rule deleted,
    // because the light hover rule still carried one — found by
    // mutation.
    expect(themed.dark).toHaveLength(2);
    expect(themed.light).toHaveLength(2);

    // Dark glows amber; light must not, or it is the smudge.
    expect(themed.dark.join(' ')).toMatch(/rgba\(252,\s*163,\s*17/);
    expect(themed.light.join(' ')).not.toMatch(/252,\s*163,\s*17/);
    expect(themed.light.join(' ')).not.toMatch(/var\(--acc/);
  });

  it('names dark explicitly rather than treating it as the default', () => {
    // The FOUC guard (index.html) and theme.js both WRITE
    // data-theme="dark", so it is a real attribute. Had it been an
    // absent default, [data-theme='dark'] would match nothing and the
    // glow would silently never appear in the one theme it is for.
    const selectors = [];
    postcss.parse(css).walkRules((r) => selectors.push(r.selector));
    expect(selectors.join(' ')).toMatch(/data-theme='dark'/);
    expect(selectors.join(' ')).toMatch(/data-theme='light'/);
  });

  it('never lets the icon match its own background on hover', () => {
    // ⚠️ THE BUG THIS REPLACED, and it was invisible in every unit test
    // and in the stylesheet read on its own.
    //
    // `.button:hover` is (0,2,0). `:global(html[data-theme='dark'])
    // .button` is (0,2,1) — element + attribute + class — so the THEME
    // rule beat the HOVER rule and `color` stayed var(--acc) while the
    // hover filled the disc with var(--acc). Amber ink on an amber
    // fill: the arrow disappeared and the control read as a solid dot.
    //
    // The rule that prevents it: every colour a hover changes must be
    // declared inside the same theme block, where it lands at (0,3,1)
    // and beats that theme's own rest rule outright rather than racing
    // it. The base :hover carries transform only — a property no theme
    // rule sets, so it cannot lose.
    const base = [];
    const themedHover = { dark: [], light: [] };
    postcss.parse(css).walkRules((rule) => {
      if (!rule.selector.includes(':hover')) return;
      const props = [];
      rule.walkDecls((d) => props.push({ prop: d.prop, value: d.value }));
      if (rule.selector.includes("data-theme='dark'")) themedHover.dark.push(...props);
      else if (rule.selector.includes("data-theme='light'")) themedHover.light.push(...props);
      else base.push(...props);
    });

    // The base hover may touch layout, never colour.
    expect(base.map((d) => d.prop).sort()).toEqual(['transform']);

    for (const theme of ['dark', 'light']) {
      const props = themedHover[theme].map((d) => d.prop);
      // If a hover paints a background it MUST restate the ink beside
      // it, or the theme's rest colour wins and can match the fill.
      if (props.includes('background')) {
        expect(props, `${theme} hover paints a background without restating color`)
          .toContain('color');
      }
      // And it must not fill with the same token the ink uses.
      const decl = Object.fromEntries(themedHover[theme].map((d) => [d.prop, d.value]));
      if (decl.background && decl.color) {
        expect(decl.background).not.toBe(decl.color);
      }
    }
  });

  /* ── reduced motion ──────────────────────────────────────────────── */

  it('scrolls instantly under reduced motion, smoothly otherwise', () => {
    // ⚠️ A JS scrollTo with an EXPLICIT behavior ignores the root's
    // computed scroll-behavior, so motion.css's root-element override
    // cannot reach this call. Passing 'smooth' unconditionally animates
    // a scroll for exactly the users who asked it not to, invisibly to
    // anyone not testing with reduce on.
    for (const [reduced, expected] of [[true, 'auto'], [false, 'smooth']]) {
      stubMotion(reduced);
      const spy = vi.fn();
      vi.stubGlobal('scrollTo', spy);

      const { unmount } = render(<ScrollToTop />);
      scrollTo(500);
      screen.getByRole('button', { name: 'Scroll to top' }).click();

      expect(spy).toHaveBeenCalledWith({ top: 0, behavior: expected });
      unmount();
      vi.unstubAllGlobals();
    }
  });

  it('hides its icon from assistive technology', () => {
    render(<ScrollToTop />);
    scrollTo(500);
    const button = screen.getByRole('button', { name: 'Scroll to top' });
    // The accessible name comes from aria-label; the arrow would
    // otherwise contribute nothing but noise.
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
