import { describe, it, expect, afterEach, vi } from 'vitest';
import { shouldShowSplash } from '../splash';

/** utils/motion.js reads window.matchMedia, so this is what it sees. */
function mockMatchMedia(matches) {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches })));
}

function setUrl(search) {
  window.history.pushState({}, '', `/${search}`);
}

describe('shouldShowSplash (PF-78)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.pushState({}, '', '/');
  });

  it('shows the splash by default', () => {
    mockMatchMedia(false);
    expect(shouldShowSplash()).toBe(true);
  });

  it('skips when ?nosplash is present', () => {
    mockMatchMedia(false);
    setUrl('?nosplash');
    expect(shouldShowSplash()).toBe(false);
  });

  it('skips when ?nosplash carries a value', () => {
    mockMatchMedia(false);
    setUrl('?nosplash=1');
    expect(shouldShowSplash()).toBe(false);
  });

  it('is unaffected by other query params', () => {
    mockMatchMedia(false);
    setUrl('?utm_source=x&splash=false');
    expect(shouldShowSplash()).toBe(true);
  });

  it('skips under prefers-reduced-motion', () => {
    mockMatchMedia(true);
    expect(shouldShowSplash()).toBe(false);
  });

  // Reduced motion is an explicit opt-in — a browser that cannot answer
  // the question gets the full experience, matching utils/motion.js's
  // own default rather than silently degrading it.
  it('shows the splash when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(shouldShowSplash()).toBe(true);
  });

  // Reads reduced motion through utils/motion.js instead of its own
  // matchMedia call, so the media query string lives in one place. If
  // someone inlines the query here again, this fails.
  it('asks matchMedia for the reduced-motion query', () => {
    const spy = vi.fn(() => ({ matches: false }));
    vi.stubGlobal('matchMedia', spy);
    shouldShowSplash();
    expect(spy).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });
});
