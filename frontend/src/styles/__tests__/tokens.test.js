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

});
