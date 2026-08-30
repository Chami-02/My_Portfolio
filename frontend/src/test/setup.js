import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock IntersectionObserver. jsdom doesn't implement it, so it has to be faked.
//
// ⚠️ This used to say "used by useInView hook". PF-89 deleted that hook — its
// last three consumers were replaced by PF-85/86/87. The real consumers now
// are the motion primitives: Reveal and CountUp, whose observer effects are
// additionally gated on useSplashReady(), which useInView never was.
globalThis.IntersectionObserver = class IntersectionObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe(element) {
    // Immediately mark as intersecting so scroll-reveal works in tests
    this.callback([{ isIntersecting: true, target: element }]);
  }
  unobserve() {}
  disconnect() {}
};

// Mock window.scrollTo (not implemented in jsdom)
globalThis.window.scrollTo = vi.fn();

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem:    (key) => store[key] ?? null,
    setItem:    (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear:      () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });
