import { render, act, fireEvent, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import StarfieldCanvas from '../StarfieldCanvas';
import { ThemeProvider } from '../../../providers/ThemeProvider';
import { MotionProvider } from '../../../providers/MotionProvider';
import { SplashProvider } from '../../../providers/SplashProvider';
import { SplashContext } from '../../../providers/SplashContext';
import { useTheme } from '../../../hooks/useTheme';

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

/** Drives a real ThemeProvider toggle from inside the tree. */
function ThemeToggleHarness() {
  const { toggle } = useTheme();
  return <button type="button" onClick={toggle}>toggle</button>;
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

  // The static frame has no draw loop to pick a palette change up on,
  // and both --acc and the star colour flip with the theme. Without the
  // repaint, a reduced-motion user toggling to light keeps the dark
  // theme's near-white stars on a light background — silently invisible.
  it('repaints the static frame when the theme changes under reduced motion', () => {
    mockMatchMedia(true);
    const ctx = mockCanvasContext();
    mockRaf();

    render(
      withProviders(
        <>
          <StarfieldCanvas />
          <ThemeToggleHarness />
        </>,
      ),
    );

    const before = ctx.clearRect.mock.calls.length;
    expect(before).toBeGreaterThan(0); // the initial paint happened

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));

    expect(ctx.clearRect.mock.calls.length).toBeGreaterThan(before);
  });

  // The draw effect's cleanup nulls the repaint ref. If it did not, the
  // ref would still hold paintStatic from the torn-down reduced run —
  // closed over that run's stars, w and h, but over the SAME live canvas
  // context — and the next theme toggle would paint a stale frame onto
  // the animating canvas. React flushes all destroys before all creates,
  // so the null lands before the animated branch starts.
  it('does not repaint a stale static frame after reduced motion turns off', () => {
    const mm = mockControllableMatchMedia(true);
    const ctx = mockCanvasContext();
    mockRaf();

    render(
      withProviders(
        <>
          <StarfieldCanvas />
          <ThemeToggleHarness />
        </>,
      ),
    );

    expect(ctx.clearRect.mock.calls.length).toBeGreaterThan(0); // static paint ran

    mm.set(false); // reduced motion off — effect re-runs into the animated branch
    const afterSwitch = ctx.clearRect.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));

    // The animated branch only clears inside frame(), and no rAF has been
    // ticked — so any increase here is a torn-down closure being invoked.
    expect(ctx.clearRect.mock.calls.length).toBe(afterSwitch);
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

    // 5000x3000 / 2600 = 5769 uncapped. Exactly one arc() per star per
    // frame — the mouse defaults to (-9999,-9999), so nothing is within
    // R=210 and neither the cursor dot nor the web adds a call. Asserted
    // as equality, not an upper bound: a build() that silently produced
    // no stars at all would satisfy "<= 620".
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

  it("still forwards an external ref, per PF-75's contract", () => {
    mockMatchMedia(false);
    mockCanvasContext();
    mockRaf();

    const ref = createRef();
    render(withProviders(<StarfieldCanvas ref={ref} />));

    expect(ref.current?.tagName).toBe('CANVAS');
  });
});
