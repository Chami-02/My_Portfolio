// frontend/src/utils/__tests__/motion.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  prefersReducedMotion,
  applyMotionPreference,
  subscribeToMotionPreference,
  MOTION_ATTR,
} from '../motion';

/** jsdom has no real matchMedia — install a controllable stub. */
function mockMatchMedia(matches) {
  const listeners = new Set();

  const mq = {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
    _fire: (next) => {
      mq.matches = next;
      listeners.forEach((fn) => fn({ matches: next }));
    },
    _count: () => listeners.size,
  };

  vi.stubGlobal('matchMedia', vi.fn(() => mq));
  return mq;
}

describe('motion utilities (PF-73)', () => {

  beforeEach(() => {
    document.documentElement.removeAttribute(MOTION_ATTR);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('prefersReducedMotion', () => {
    it('is true when the query matches', () => {
      mockMatchMedia(true);
      expect(prefersReducedMotion()).toBe(true);
    });

    it('is false when it does not', () => {
      mockMatchMedia(false);
      expect(prefersReducedMotion()).toBe(false);
    });

    // Full motion is the default. Reduced is an explicit opt-in.
    it('defaults to false when matchMedia is unavailable', () => {
      vi.stubGlobal('matchMedia', undefined);
      expect(prefersReducedMotion()).toBe(false);
    });
  });

  describe('applyMotionPreference', () => {
    it('sets the attribute when reduced', () => {
      applyMotionPreference(true);
      expect(document.documentElement.getAttribute(MOTION_ATTR)).toBe('reduced');
    });

    it('removes the attribute when not reduced', () => {
      document.documentElement.setAttribute(MOTION_ATTR, 'reduced');
      applyMotionPreference(false);
      expect(document.documentElement.hasAttribute(MOTION_ATTR)).toBe(false);
    });

    // Same trap as PF-72 — an inline custom property on <html>
    // would beat the token blocks in the cascade.
    it('sets no inline styles on documentElement', () => {
      applyMotionPreference(true);
      expect(document.documentElement.getAttribute('style')).toBeNull();
    });
  });

  describe('subscribeToMotionPreference', () => {
    it('fires the callback on change', () => {
      const mq = mockMatchMedia(false);
      const cb = vi.fn();

      subscribeToMotionPreference(cb);
      mq._fire(true);

      expect(cb).toHaveBeenCalledWith(true);
    });

    it('unsubscribes cleanly', () => {
      const mq = mockMatchMedia(false);
      const cb = vi.fn();

      const off = subscribeToMotionPreference(cb);
      expect(mq._count()).toBe(1);

      off();
      expect(mq._count()).toBe(0);

      mq._fire(true);
      expect(cb).not.toHaveBeenCalled();
    });

    it('returns a no-op when matchMedia is unavailable', () => {
      vi.stubGlobal('matchMedia', undefined);
      const off = subscribeToMotionPreference(vi.fn());
      expect(() => off()).not.toThrow();
    });
  });

});
