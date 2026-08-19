// frontend/src/utils/__tests__/parallax.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeParallaxTransform } from '../parallax';

function elementAt(tag, top, height) {
  const el = document.createElement(tag);
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ top, height });
  return el;
}

describe('computeParallaxTransform (PF-80)', () => {
  beforeEach(() => {
    window.innerHeight = 900;
  });

  it('translates only, for a non-IMG element', () => {
    const el = elementAt('div', 100, 200);

    const result = computeParallaxTransform(el, 0.12);
    expect(result).not.toContain('scale');
    expect(result).toMatch(/^translate3d\(0,-?\d+(\.\d)?px,0\)$/);
  });

  it('adds scale(1.1) for an IMG element', () => {
    const el = elementAt('img', 100, 200);

    const result = computeParallaxTransform(el, 0.05);
    expect(result).toContain('scale(1.1)');
  });

  // The exact arithmetic, not just its shape. mid = 100 + 100 - 450 =
  // -250; -(-250) * 0.12 = 30.0. A sign flip here would still produce a
  // plausible-looking translate3d and would drift the grid the wrong way.
  it('computes the prototype\'s exact value and sign', () => {
    const el = elementAt('div', 100, 200);
    expect(computeParallaxTransform(el, 0.12)).toBe('translate3d(0,30.0px,0)');
  });

  it('is zero when the element is centred in the viewport', () => {
    const el = elementAt('div', 350, 200);   // mid = 350 + 100 - 450 = 0
    expect(computeParallaxTransform(el, 0.12)).toBe('translate3d(0,0.0px,0)');
  });

  it('reverses sign once the element passes the centre', () => {
    const el = elementAt('div', 600, 200);   // mid = +250
    expect(computeParallaxTransform(el, 0.12)).toBe('translate3d(0,-30.0px,0)');
  });

  it('rounds to one decimal, matching the prototype\'s toFixed(1)', () => {
    const el = elementAt('div', 123, 200);   // mid = -227 → 27.24
    expect(computeParallaxTransform(el, 0.12)).toBe('translate3d(0,27.2px,0)');
  });
});
