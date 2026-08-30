import { render, act } from '@testing-library/react';
import { createRef } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import StarfieldCanvas from '../StarfieldCanvas';
import { ThemeProvider } from '../../../providers/ThemeProvider';
import { MotionProvider } from '../../../providers/MotionProvider';
import { SplashProvider } from '../../../providers/SplashProvider';
import { SplashContext } from '../../../providers/SplashContext';

function mockMatchMedia(matches) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
}

// A single shared MediaQueryList whose `matches` can be flipped and
// broadcast, so MotionProvider's own subscription drives the change.
// Must be one object across calls: prefersReducedMotion() reads
// .matches on the first call, subscribeToMotionPreference() registers
// on the second, and a fresh object per call would decouple them.
function mockControllableMatchMedia(initial) {
  const listeners = new Set();
  const mq = {
    _matches: initial,
    get matches() { return mq._matches; },
    addEventListener: (_type, h) => listeners.add(h),
    removeEventListener: (_type, h) => listeners.delete(h),
  };
  vi.stubGlobal('matchMedia', vi.fn(() => mq));
  return {
    set: (v) => {
      mq._matches = v;
      act(() => { listeners.forEach((h) => h({ matches: v })); });
    },
  };
}

/** The cross-tab path ThemeProvider listens on — a real theme change. */
function toggleThemeViaStorage() {
  act(() => {
    localStorage.setItem('pg-theme', 'light');
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'pg-theme', newValue: 'light' }),
    );
  });
}

function mockCanvasContext() {
  const ctx = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    setTransform: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    fillStyle: '',
    strokeStyle: '',
    globalAlpha: 1,
    lineWidth: 1,
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
  return ctx;
}

// Map-based, not array-based — cancelAnimationFrame has to actually
// remove the pending callback for the visibilitychange test to mean
// anything. An array with a no-op cancel would report "pending" frames
// regardless of whether the loop was really paused.
function mockRaf() {
  let nextId = 1;
  const frames = new Map();
  vi.stubGlobal('requestAnimationFrame', (cb) => {
    const id = nextId++;
    frames.set(id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id) => {
    frames.delete(id);
  });
  return {
    tick: (t) => {
      const entries = [...frames.entries()];
      frames.clear();
      entries.forEach(([, cb]) => act(() => cb(t)));
    },
    pending: () => frames.size,
  };
}

function withProviders(ui, { splashReady = true } = {}) {
  return (
    <ThemeProvider>
      <MotionProvider>
        {splashReady ? (
          <SplashProvider>{ui}</SplashProvider>
        ) : (
          <SplashContext.Provider value={{ ready: false, setReady: () => {} }}>
            {ui}
          </SplashContext.Provider>
        )}
      </MotionProvider>
    </ThemeProvider>
  );
}

describe('StarfieldCanvas (PF-76)', () => {
  beforeEach(() => {
    window.innerWidth = 1440;
    window.innerHeight = 900;
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    // The theme-repaint test below writes pg-theme via localStorage.
    // setup.js's mock has a module-level store that never resets on
    // its own, so a later test here (or elsewhere in the same worker)
    // would otherwise start in whatever theme this one left behind.
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('does not start a loop while blocked by the splash', () => {
    mockMatchMedia(false);
    mockCanvasContext();
    const raf = mockRaf();

    render(withProviders(<StarfieldCanvas />, { splashReady: false }));

    expect(raf.pending()).toBe(0);
  });

  it('starts the loop once the splash is ready', () => {
    mockMatchMedia(false);
    mockCanvasContext();
    const raf = mockRaf();

    render(withProviders(<StarfieldCanvas />));

    expect(raf.pending()).toBeGreaterThan(0);
  });

  it('paints once and starts no loop under reduced motion', () => {
    mockMatchMedia(true);
    const ctx = mockCanvasContext();
    const raf = mockRaf();

    render(withProviders(<StarfieldCanvas />));

    expect(raf.pending()).toBe(0);
    expect(ctx.arc).toHaveBeenCalled(); // static paint still draws stars
  });

  it('caps device pixel ratio at 2', () => {
    mockMatchMedia(false);
    mockCanvasContext();
    mockRaf();
    Object.defineProperty(window, 'devicePixelRatio', { value: 4, configurable: true });

    let node;
    render(withProviders(<StarfieldCanvas ref={(n) => { node = n; }} />));

    expect(node.width).toBe(1440 * 2);
  });

  it('caps star count at 620 for a huge viewport', () => {
    mockMatchMedia(false);
    const ctx = mockCanvasContext();
    const raf = mockRaf();
    window.innerWidth = 5000;
    window.innerHeight = 3000;

    render(withProviders(<StarfieldCanvas />));
    raf.tick(0);

    // 5000×3000 / 2600 = 5769 uncapped. Exactly one arc() per star per
    // frame — mouse defaults to (-9999,-9999), so nothing is within
    // R=210 and neither the cursor dot nor the web adds a call.
    // Asserted as equality, not an upper bound: a build() that silently
    // produced zero stars would still satisfy "<= 620".
    expect(ctx.arc.mock.calls.length).toBe(620);
  });

  it('does not throw when the cursor is near a star', () => {
    // Smoke test for the near-cursor code path — the one the
    // prototype's undeclared `acc` broke every frame it ran.
    mockMatchMedia(false);
    mockCanvasContext();
    const raf = mockRaf();
    window.innerWidth = 100;
    window.innerHeight = 100; // small viewport, R=210 covers all of it

    render(withProviders(<StarfieldCanvas />));

    expect(() => {
      act(() => {
        window.dispatchEvent(new MouseEvent('pointermove', { clientX: 50, clientY: 50 }));
      });
      raf.tick(0);
    }).not.toThrow();
  });

  it('pauses on visibilitychange to hidden, resumes when visible', () => {
    mockMatchMedia(false);
    mockCanvasContext();
    const raf = mockRaf();

    render(withProviders(<StarfieldCanvas />));
    raf.tick(0); // consume the initial frame; it re-arms itself

    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(raf.pending()).toBe(0);

    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(raf.pending()).toBeGreaterThan(0);
  });

  it('removes every listener and cancels the frame on unmount', () => {
    mockMatchMedia(false);
    mockCanvasContext();
    mockRaf();
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const removeDocSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = render(withProviders(<StarfieldCanvas />));
    unmount();

    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('pointermove', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('pointerleave', expect.any(Function));
    expect(removeDocSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });

  it(`still forwards an external ref, per PF-75's contract`, () => {
    mockMatchMedia(false);
    mockCanvasContext();
    mockRaf();

    const ref = createRef();
    render(withProviders(<StarfieldCanvas ref={ref} />));

    expect(ref.current?.tagName).toBe('CANVAS');
  });

  it('repaints the static frame on a theme toggle under reduced motion', () => {
    // Regression test for the gap found during implementation: without
    // this, a reduced-motion user toggling theme keeps the OLD palette
    // permanently — pal() only runs once, at paint time, on this path,
    // unlike the animated path where every frame re-reads it for free.
    // Mutation-tested: deleting the repaintStaticRef.current?.() call in
    // the theme-sync effect makes this test fail and nothing else in the
    // file. Deleting the null-out in the effect cleanup does NOT fail
    // this test — that line is guarded by the next test instead, since
    // this one never tears the reduced-motion effect down.
    mockMatchMedia(true);
    const ctx = mockCanvasContext();
    mockRaf();

    render(withProviders(<StarfieldCanvas />));
    const callsBeforeToggle = ctx.arc.mock.calls.length;
    expect(callsBeforeToggle).toBeGreaterThan(0); // initial static paint happened

    toggleThemeViaStorage();

    // A second static paint happened — same star count, new palette.
    expect(ctx.arc.mock.calls.length).toBeGreaterThan(callsBeforeToggle);
  });

  it('does not repaint a stale static frame after reduced motion turns off', () => {
    // Guards the null-out in the reduced branch's cleanup. Without it the
    // ref still holds paintStatic from the torn-down reduced run — closed
    // over that run's stars, w and h, but over the SAME live canvas
    // context — so the next theme toggle paints a stale frame onto the
    // animating canvas. React flushes every destroy before any create, so
    // the null lands before the animated branch starts.
    const mm = mockControllableMatchMedia(true);
    const ctx = mockCanvasContext();
    mockRaf();

    render(withProviders(<StarfieldCanvas />));
    expect(ctx.arc.mock.calls.length).toBeGreaterThan(0); // static paint ran

    mm.set(false); // reduced motion off — effect re-runs into the animated branch
    const callsAfterSwitch = ctx.arc.mock.calls.length;

    toggleThemeViaStorage();

    // The animated branch only draws inside frame(), and no rAF has been
    // ticked — so any increase here is a torn-down closure being invoked.
    expect(ctx.arc.mock.calls.length).toBe(callsAfterSwitch);
  });

  /**
   * The three owner-requested tuning constants, guarded as SOURCE TEXT.
   *
   * Every one of them deviates from the Portfolio prototype on purpose,
   * which makes them the exact shape a fidelity pass "corrects" back:
   * diffing this file against the prototype shows 105 vs 150, 0.065 vs
   * 0.14 and 0.16 vs 0.09, and all three read as transcription slips
   * unless you already know they are not. Reverting any of them is
   * silent — the canvas still paints, nothing errors, no other test
   * moves — so the deviation itself is what needs pinning.
   *
   * Asserted against the file's text rather than by driving the canvas:
   * the values are baked into `Math.random()`-seeded per-star fields,
   * so recovering them from a rendered frame means stubbing randomness
   * and inverting the seeding arithmetic — a test that would break on
   * any refactor of how stars are built, while proving less.
   */
  it('pins the owner-requested tuning constants against a fidelity revert', () => {
    // fileURLToPath + join, matching styles/__tests__/animations.test.js.
    // Passing the URL object straight to readFileSync throws
    // "The URL must be of scheme file" under this environment.
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, '..', 'StarfieldCanvas.jsx'), 'utf8')
      // Comments stripped first: all three values appear in the prose
      // explaining them, so a raw search matches the comment and passes
      // while the constant says anything at all. See CLAUDE.md on
      // raw-text assertions matching comments.
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

    // ⚠️ Asserted as "not the prototype's value", NOT as an exact
    // number. These are look-and-feel dials the owner re-tunes by eye —
    // STAR_DRIFT went 0.09 → 0.16 → 0.35 in a single session. A test
    // pinning the exact figure turns every one of those adjustments
    // into a red suite, which trains people to edit the test without
    // reading it and kills the guard's real job. What must never happen
    // is a silent revert TO the prototype during a fidelity pass, and
    // that is exactly what these assert.
    const num = (name) => {
      const m = src.match(new RegExp(`const ${name} = ([0-9.]+);`));
      expect(m, `${name} must be declared as a numeric literal`).not.toBeNull();
      return Number(m[1]);
    };

    // Web mesh: toned DOWN from the prototype, so smaller is the
    // sanctioned direction.
    expect(num('WEB_LINK_PX')).toBeLessThan(150); // prototype
    expect(num('WEB_ALPHA')).toBeLessThan(0.14); // prototype

    // Star drift: toned UP, so larger is the sanctioned direction.
    // 0.09 is the Portfolio prototype's and 0.08 is the Blog's — either
    // appearing here means the deviation was reverted.
    expect(num('STAR_DRIFT')).toBeGreaterThan(0.09);

    // STAR_DRIFT must actually reach both axes — a constant that is
    // declared and then not used is the same silent revert by a
    // different route.
    expect(src).toMatch(/vx: \(Math\.random\(\) - 0\.5\) \* STAR_DRIFT,/);
    expect(src).toMatch(/vy: \(Math\.random\(\) - 0\.5\) \* STAR_DRIFT,/);

    // Twinkle was deliberately left at the prototype's rate.
    expect(src).toMatch(/s\.t \+= 0\.02 \* s\.ts;/);
  });
});
