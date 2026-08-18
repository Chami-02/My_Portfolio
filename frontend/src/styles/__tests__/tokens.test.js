// frontend/src/styles/__tests__/tokens.test.js
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const css  = readFileSync(resolve(here, '../tokens.css'), 'utf8');

const FLAT = [
  '--acc', '--acc2', '--acc2rgb', '--accInk',
  '--bg', '--text', '--strong', '--muted', '--muted2', '--faint', '--thumb',
  '--navy', '--ink', '--grey',
  '--ok', '--danger',
];

const TRIPLETS = ['--gnd', '--srf', '--ln', '--ftr', '--shd'];

// Everything that must be redefined for the light theme
const LIGHT_OVERRIDES = [
  '--acc', '--acc2', '--acc2rgb', '--accInk',
  '--bg', '--text', '--strong', '--muted', '--muted2', '--faint', '--thumb',
  '--gnd', '--srf', '--ln', '--ftr', '--shd',
  '--ok', '--danger',
];

const lightBlock = css.slice(css.indexOf('html[data-theme="light"]'));

describe('Design tokens (PF-67)', () => {

  it.each(FLAT)('defines %s in the dark theme', (token) => {
    expect(css).toMatch(new RegExp(`${token}\\s*:`));
  });

  it.each(TRIPLETS)('defines %s in the dark theme', (token) => {
    expect(css).toMatch(new RegExp(`${token}\\s*:`));
  });

  it.each(LIGHT_OVERRIDES)('overrides %s in the light theme', (token) => {
    expect(lightBlock).toMatch(new RegExp(`${token}\\s*:`));
  });

  // The critical one — a triplet written as hex breaks every
  // translucent surface, and rgba(#hex, .5) fails silently.
  it.each(TRIPLETS)('%s is a bare R,G,B triplet, not a hex', (token) => {
    const matches = [...css.matchAll(new RegExp(`${token}\\s*:\\s*([^;]+);`, 'g'))];

    expect(matches.length).toBeGreaterThan(0);

    for (const [, value] of matches) {
      expect(value.trim()).not.toMatch(/^#/);
      expect(value.trim()).toMatch(/^\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}$/);
    }
  });

  it('warms the light-theme whites rather than using pure white', () => {
    expect(lightBlock).toMatch(/--gnd:\s*251,\s*248,\s*243/);
    expect(lightBlock).toMatch(/--srf:\s*254,\s*252,\s*248/);
  });

  it('deepens the light accent and flips the ink', () => {
    expect(lightBlock).toMatch(/--acc:\s*#7E4800/i);
    expect(lightBlock).toMatch(/--accInk:\s*#ffffff/i);
  });

  it('publishes --header-h for sections to offset their anchor jumps (PF-79)', () => {
    // 12px padding + 44px logo + 12px padding + 2px progress track +
    // 1px bottom border. Confirmed against the rendered header's
    // getBoundingClientRect().height in Chromium — the border is the
    // easy pixel to lose, and a --header-h that is short by one lands
    // every section heading a hair under the fixed header with no
    // error to show for it.
    expect(css).toMatch(/--header-h:\s*71px/);
  });

  /* ── Phase 1 light-theme bridge (2026-08-18) ────────────────────────
   * Temporary block that re-points Phase 1's never-flipping text tokens
   * for the three sections still using them. Its correctness is entirely
   * in the SCOPE: the same tokens are read by every admin panel, whose
   * surfaces are the un-flipped dark --bg-surface, so widening this to
   * `html[data-theme="light"]` would put dark text on dark panels and
   * break /admin — the identical bug, moved. Nothing in the stylesheet
   * looks wrong if that happens, which is why it is pinned here. */
  describe('Phase 1 light-theme bridge', () => {
    // Comments stripped — the rule documents the #818cf8 / #7E4800 it is
    // replacing, and a raw hex check matches the explanation rather than
    // a declaration. Third time this file pattern has bitten; strip first.
    const bridge = css
      .slice(
        css.indexOf('html[data-theme="light"] #projects'),
        css.indexOf('}', css.indexOf('html[data-theme="light"] #projects')),
      )
      .replace(/\/\*[\s\S]*?\*\//g, '');

    it('exists and covers all three Phase 1 sections', () => {
      expect(bridge).toContain('#projects');
      expect(bridge).toContain('#blog');
      expect(bridge).toContain('#contact');
    });

    it('rescopes the tokens that never flip on their own', () => {
      ['--text-primary', '--text-body', '--text-muted', '--bg-surface', '--accent']
        .forEach((t) => expect(bridge).toContain(t));
    });

    it('maps onto Phase 2 tokens rather than a second hardcoded palette', () => {
      expect(bridge).toContain('--text-primary:  var(--strong)');
      expect(bridge).toContain('--text-body:     var(--text)');
      expect(bridge).toContain('--text-muted:    var(--muted2)');
      // Phase 1's indigo #818cf8 is 2.44:1 on the paper ground; --acc was
      // deepened to #7E4800 (6.12:1) for exactly this reason, so the
      // bridge points at the token rather than picking a third colour.
      expect(bridge).toContain('--accent:        var(--acc)');
      // No fresh hex — every colour resolves through a Phase 2 token, so
      // these sections track the palette until Sprint 12 replaces them.
      expect(bridge).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    });

    // The load-bearing assertion. A bare html[data-theme="light"] rule
    // redefining --text-primary would reach every admin panel.
    it('never redefines these tokens unscoped, which would break /admin', () => {
      const unscoped = css.match(/html\[data-theme="light"\]\s*\{[\s\S]*?\n\}/);
      expect(unscoped).not.toBeNull();
      ['--text-primary', '--text-body', '--text-muted', '--bg-surface', '--accent', '--border']
        .forEach((t) => expect(unscoped[0]).not.toContain(t));
    });
  });

});
