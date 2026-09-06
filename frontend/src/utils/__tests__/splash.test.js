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

// ══════════════════════════════════════════════════════════════════════
/**
 * ⚠️ EVERY TEST HERE IMPORTS THE MODULE FRESH, and that is the whole
 * reason this is a separate block.
 *
 * `shownThisDocument` is module state — deliberately, because it is what
 * makes a refresh replay the splash and a client-side navigation not. In a
 * test file that means one test's `markSplashShown()` would leak into the
 * next, and a suite that runs green in either order while asserting
 * nothing is exactly the failure this project keeps finding.
 *
 * `vi.resetModules()` + `await import()` gives each case its own module
 * instance, which is the closest thing a test has to a fresh page load —
 * and it keeps the reset out of production surface, where an exported
 * `resetForTests()` would sit forever with one caller.
 */
describe('shouldShowSplash — once per document load (PF-106)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.pushState({}, '', '/');
  });

  /** A fresh module instance — the unit-test equivalent of a page load. */
  async function freshLoad() {
    vi.resetModules();
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    return import('../splash');
  }

  it('shows the splash on the first ask of a document', async () => {
    const { shouldShowSplash: fn } = await freshLoad();
    expect(fn()).toBe(true);
  });

  it('does NOT show it again once the splash has finished', async () => {
    // The Back-button journey this ticket exists for: HomePage unmounts,
    // remounts, and asks again within the same document.
    const { shouldShowSplash: fn, markSplashShown } = await freshLoad();
    expect(fn()).toBe(true);
    markSplashShown();
    expect(fn()).toBe(false);
    expect(fn()).toBe(false);   // and stays false, however often it is asked
  });

  it('shows it again after a reload, because the module is new', async () => {
    // ⚠️ The owner's second requirement, and the reason this is module
    // state rather than sessionStorage — which survives a reload and would
    // make refresh the one journey that did NOT replay.
    const first = await freshLoad();
    first.markSplashShown();
    expect(first.shouldShowSplash()).toBe(false);

    const second = await freshLoad();          // i.e. a refresh
    expect(second.shouldShowSplash()).toBe(true);
  });

  it('the flag outranks a clean URL, not the other way round', async () => {
    // Discriminating on purpose: with the flag set AND no ?nosplash, a
    // gate that only consulted the URL would return true here.
    const { shouldShowSplash: fn, markSplashShown } = await freshLoad();
    markSplashShown();
    window.history.pushState({}, '', '/');
    expect(fn()).toBe(false);
  });

  it('leaves ?nosplash and reduced motion working on their own', async () => {
    // The flag is an ADDITIONAL reason to skip, never a replacement — QA
    // and the reduced-motion opt-in must still work on a first ask.
    const { shouldShowSplash: fn } = await freshLoad();
    window.history.pushState({}, '', '/?nosplash=1');
    expect(fn()).toBe(false);

    const { shouldShowSplash: rm } = await freshLoad();
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    expect(rm()).toBe(false);
  });
});
