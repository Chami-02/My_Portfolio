import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Splash from '../Splash';
import { SplashProvider } from '../../../providers/SplashProvider';
import { MotionProvider } from '../../../providers/MotionProvider';
import { useSplashReady } from '../../../hooks/useSplashReady';
import Reveal from '../../motion/Reveal';

function ReadyProbe() {
  return <span data-testid="ready">{String(useSplashReady())}</span>;
}

/** Exactly how HomePage mounts it: ready already false before first paint. */
const withSplash = (ui) => (
  <SplashProvider initialReady={false}>
    {ui}
    <ReadyProbe />
  </SplashProvider>
);

const advance = (ms) => act(() => { vi.advanceTimersByTime(ms); });

const rootOf = (container) => container.querySelector('[class*="splash"]');

/* Mirrors of Splash.jsx's own constants, duplicated on purpose rather
   than imported: exporting them alongside the component would put a
   non-component export in a component file, and the point of a timing
   test is to PIN the numbers. Change Splash.jsx and these fail, which
   is the intended alarm. */
const SPLASH_MS = 4500;
const PROTOTYPE_SPLASH_MS = 4600;
const BAR_START_MS = 220;
const BAR_TICK_MS = 140;
const BAR_TRANSITION_MS = 250;
const BOOT_FIRST_MS = Math.round(SPLASH_MS * (560 / PROTOTYPE_SPLASH_MS));
const BOOT_STEP_MS = Math.round(SPLASH_MS * (820 / PROTOTYPE_SPLASH_MS));
const BAR_TICKS = Math.ceil(
  (SPLASH_MS - BAR_START_MS - BAR_TRANSITION_MS) / BAR_TICK_MS,
);
/** When the final tick fires — bar writes 100% here. */
const LAST_TICK_MS = BAR_START_MS + (BAR_TICKS - 1) * BAR_TICK_MS;
/** The last of the four boot lines. */
const LAST_BOOT_MS = BOOT_FIRST_MS + 3 * BOOT_STEP_MS;
const pctAtTick = (n) => `${Math.round((n / BAR_TICKS) * 100)}%`;

describe('Splash (PF-78)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('mounts with ready already false and does not flip it itself', () => {
    render(withSplash(<Splash />));
    expect(screen.getByTestId('ready')).toHaveTextContent('false');

    // Nothing up to the finish trigger may change this. If Splash ever
    // starts calling setReady(false) from its own effect instead of
    // relying on initialReady, this still passes — which is why the
    // race is guarded in SplashProvider.test.jsx too, not only here.
    advance(SPLASH_MS - 1);
    expect(screen.getByTestId('ready')).toHaveTextContent('false');
  });

  it('renders a resolvable logo, not a bare path', () => {
    render(withSplash(<Splash />));
    const img = screen.getByAltText('Parindra Gallage');
    // Imported through Vite rather than referenced as /assets/logo.png:
    // a missing import fails the build, a missing public path 404s in
    // silence.
    expect(img.getAttribute('src')).toMatch(/logo\.png/);
  });

  it('reveals the four boot lines spread across the sequence', () => {
    const { container } = render(withSplash(<Splash />));
    const lines = container.querySelectorAll('[class*="bootLine"]');
    expect(lines).toHaveLength(4);

    // Resting opacity lives in the stylesheet, which Vitest stubs — so
    // "not yet revealed" is an empty inline style, not '0'.
    expect(lines[0].style.opacity).toBe('');

    advance(BOOT_FIRST_MS - 1);
    expect(lines[0].style.opacity).toBe('');

    advance(1);
    expect(lines[0].style.opacity).toBe('1');
    expect(lines[0].style.transform).toBe('none');
    expect(lines[1].style.opacity).toBe('');

    advance(BOOT_STEP_MS);
    expect(lines[1].style.opacity).toBe('1');

    advance(BOOT_STEP_MS);
    expect(lines[2].style.opacity).toBe('1');

    advance(BOOT_STEP_MS);
    expect(lines[3].style.opacity).toBe('1');

    // The last line must land with time left to read it, not flash past
    // as the splash leaves. Derived from SPLASH_MS, so this keeps
    // holding if the sequence length changes again.
    expect(SPLASH_MS - LAST_BOOT_MS).toBeGreaterThanOrEqual(1500);
  });

  it('ticks the progress bar to exactly 100 and then stops', () => {
    const { container } = render(withSplash(<Splash />));

    const bar = container.querySelector('[class*="progressFill"]');
    const label = container.querySelector('[class*="progressLabels"] span:last-child');
    expect(label.textContent).toBe('0%');

    advance(BAR_START_MS);              // first tick
    expect(label.textContent).toBe(pctAtTick(1));

    advance(BAR_TICK_MS);               // second
    expect(label.textContent).toBe(pctAtTick(2));

    advance(LAST_TICK_MS - BAR_START_MS - BAR_TICK_MS);
    expect(label.textContent).toBe('100%');
    expect(bar.style.width).toBe('100%');

    // And no further ticks were queued once it hit 100.
    advance(1000);
    expect(label.textContent).toBe('100%');
    expect(bar.style.width).toBe('100%');
  });

  it('shows the percentage unpadded — 3%, not 003%', () => {
    const { container } = render(withSplash(<Splash />));
    const label = container.querySelector('[class*="progressLabels"] span:last-child');

    // The prototype zero-fills to three digits. Dropped at the owner's
    // request, so a regression here is a visible one.
    expect(label.textContent).toBe('0%');
    advance(BAR_START_MS);
    expect(label.textContent).toBe(pctAtTick(1));
    expect(label.textContent).not.toMatch(/^0\d/);

    advance(LAST_TICK_MS);
    expect(label.textContent).toBe('100%');
  });

  it('fills the bar in step with the exit, not well ahead of it', () => {
    // THE BUG THIS GUARDS. The prototype's increment was random
    // (Math.random()*6 + 2.2 per 140ms), so the bar finished around
    // 2.9s and then sat full for another 1.7s while the splash ran on
    // to 4600ms — a visible dead gap, and the reason these two numbers
    // are now derived from one another rather than chosen separately.
    const { container } = render(withSplash(<Splash />));
    const bar = container.querySelector('[class*="progressFill"]');

    // Still climbing one tick before the end.
    advance(LAST_TICK_MS - BAR_TICK_MS);
    expect(parseFloat(bar.style.width)).toBeLessThan(100);

    // Full, and the splash has NOT left yet.
    advance(BAR_TICK_MS);
    expect(bar.style.width).toBe('100%');
    expect(rootOf(container)).not.toHaveAttribute('data-exiting');

    // The gap between the bar landing and the exit is one CSS
    // transition-length or so — not seconds.
    const visuallyFull = LAST_TICK_MS + BAR_TRANSITION_MS;
    expect(SPLASH_MS - visuallyFull).toBeGreaterThanOrEqual(0);
    expect(SPLASH_MS - visuallyFull).toBeLessThan(400);
  });

  it('starts exiting at SPLASH_MS, not when the bar fills', () => {
    const { container } = render(withSplash(<Splash />));

    advance(SPLASH_MS - 1);
    expect(rootOf(container)).not.toHaveAttribute('data-exiting');

    advance(1);
    expect(rootOf(container)).toHaveAttribute('data-exiting');
  });

  it('arms reveals 320ms after the exit begins, not immediately', () => {
    render(withSplash(<Splash />));

    advance(SPLASH_MS);
    expect(screen.getByTestId('ready')).toHaveTextContent('false');

    advance(319);
    expect(screen.getByTestId('ready')).toHaveTextContent('false');

    advance(1);
    expect(screen.getByTestId('ready')).toHaveTextContent('true');
  });

  it('leaves the DOM 1150ms after the exit begins', () => {
    const { container } = render(withSplash(<Splash />));

    advance(SPLASH_MS + 1149);
    expect(rootOf(container)).toBeTruthy();

    advance(1);
    expect(rootOf(container)).toBeNull();
  });

  it('SKIP runs the same finish sequence immediately', () => {
    const { container } = render(withSplash(<Splash />));

    advance(1000);
    act(() => { screen.getByText('SKIP INTRO →').click(); });

    expect(rootOf(container)).toHaveAttribute('data-exiting');
    expect(screen.getByTestId('ready')).toHaveTextContent('false');

    advance(320);
    expect(screen.getByTestId('ready')).toHaveTextContent('true');

    advance(1150 - 320);
    expect(rootOf(container)).toBeNull();
  });

  it('SKIP cancels boot lines that had not appeared yet', () => {
    const { container } = render(withSplash(<Splash />));
    const lines = container.querySelectorAll('[class*="bootLine"]');

    advance(BOOT_FIRST_MS);
    expect(lines[0].style.opacity).toBe('1');

    act(() => { screen.getByText('SKIP INTRO →').click(); });
    advance(5000);

    expect(lines[1].style.opacity).toBe('');
    expect(lines[2].style.opacity).toBe('');
    expect(lines[3].style.opacity).toBe('');
  });

  // Without finishedRef, this second finish would clear the pending
  // ready/unmount timers and schedule fresh ones — reveals arming 320ms
  // late and the splash lingering another 1150ms, with nothing to
  // explain either.
  it('a SKIP click after the SPLASH_MS finish does not restart the exit clock', () => {
    const { container } = render(withSplash(<Splash />));

    advance(SPLASH_MS);
    act(() => { screen.getByText('SKIP INTRO →').click(); });

    advance(320);
    expect(screen.getByTestId('ready')).toHaveTextContent('true');

    advance(1150 - 320);
    expect(rootOf(container)).toBeNull();
  });

  it('leaves no timer pending after unmount', () => {
    const { unmount } = render(withSplash(<Splash />));
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  // The whole reason this ticket exists. setup.js's IntersectionObserver
  // mock reports isIntersecting the moment anything observes, so a Reveal
  // whose effect has armed goes to data-reveal="in" instantly — which
  // makes this a precise canary: "in" before the splash lifts means the
  // gate is broken, exactly the silent failure PF-75 was built to stop.
  it('holds Reveals shut for the entire splash, then releases them', () => {
    const { container } = render(
      <MotionProvider>
        {withSplash(
          <>
            <Splash />
            <Reveal data-testid="gated">hero</Reveal>
          </>,
        )}
      </MotionProvider>,
    );

    const gated = container.querySelector('[data-testid="gated"]');
    expect(gated).toHaveAttribute('data-reveal', 'out');

    advance(SPLASH_MS);
    expect(gated).toHaveAttribute('data-reveal', 'out');

    advance(319);
    expect(gated).toHaveAttribute('data-reveal', 'out');

    advance(1);
    expect(gated).toHaveAttribute('data-reveal', 'in');
  });
});
