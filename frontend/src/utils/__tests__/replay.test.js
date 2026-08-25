// frontend/src/utils/__tests__/replay.test.js
//
// PF-88. The one part of REPLAY INTRO that is a correctness decision
// rather than a transcription: a JS scrollTo with an explicit `behavior`
// is NOT reached by motion.css's root-element scroll-behavior override,
// so the preference has to be read here or it is silently ignored for
// the one audience it exists for.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { beginReplay } from '../replay';

/** matchMedia is what prefersReducedMotion() reads. */
const stubMotion = (reduced) =>
  vi.stubGlobal('matchMedia', vi.fn((query) => ({
    matches: reduced && query === '(prefers-reduced-motion: reduce)',
    addEventListener: () => {},
    removeEventListener: () => {},
  })));

describe('beginReplay (PF-88)', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('scrolls smoothly to the top and asks for a splash, by default', () => {
    stubMotion(false);
    expect(beginReplay()).toBe(true);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('scrolls INSTANTLY and asks for no splash under reduced motion', () => {
    // Both halves matter and both are invisible to anyone testing
    // normally: 'smooth' here would animate a scroll the user asked not
    // to animate, and a splash is almost nothing but motion.
    stubMotion(true);
    expect(beginReplay()).toBe(false);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });

  it('never passes the prototype\'s hardcoded "smooth" under reduce', () => {
    // The mutation this guards: copying line 1147 verbatim.
    stubMotion(true);
    beginReplay();
    const [{ behavior }] = window.scrollTo.mock.calls[0];
    expect(behavior).not.toBe('smooth');
  });

  it('ignores ?nosplash — the button is an explicit request', () => {
    // ?nosplash is the escape hatch for the AUTOMATIC splash on load
    // (prototype line 897), and utils/nav.js appends it to every
    // off-home link home. Honouring it here would make the button
    // silently inert for anyone arriving from the blog.
    stubMotion(false);
    window.history.replaceState({}, '', '/?nosplash=1');
    try {
      expect(beginReplay()).toBe(true);
    } finally {
      window.history.replaceState({}, '', '/');
    }
  });

  it('does not throw when scrollTo is unavailable', () => {
    stubMotion(false);
    window.scrollTo = undefined;
    expect(() => beginReplay()).not.toThrow();
  });
});
