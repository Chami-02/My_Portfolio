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
    advance(4599);
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

  it('reveals boot lines at 560, 1380, 2200, 3020', () => {
    const { container } = render(withSplash(<Splash />));
    const lines = container.querySelectorAll('[class*="bootLine"]');
    expect(lines).toHaveLength(4);

    // Resting opacity lives in the stylesheet, which Vitest stubs — so
    // "not yet revealed" is an empty inline style, not '0'.
    expect(lines[0].style.opacity).toBe('');

    advance(559);
    expect(lines[0].style.opacity).toBe('');

    advance(1);
    expect(lines[0].style.opacity).toBe('1');
    expect(lines[0].style.transform).toBe('none');
    expect(lines[1].style.opacity).toBe('');

    advance(820);
    expect(lines[1].style.opacity).toBe('1');

    advance(820);
    expect(lines[2].style.opacity).toBe('1');

    advance(820);
    expect(lines[3].style.opacity).toBe('1');
  });

  it('ticks the progress bar to exactly 100 and then stops', () => {
    // Math.min clamps the last tick, but only a fixed increment makes
    // "lands on 100, never 104.2" a deterministic assertion.
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // → +5.2 per tick
    const { container } = render(withSplash(<Splash />));

    const bar = container.querySelector('[class*="progressFill"]');
    const label = container.querySelector('[class*="progressLabels"] span:last-child');
    expect(label.textContent).toBe('000%');

    advance(220);                       // first tick
    expect(label.textContent).toBe('005%');
    expect(bar.style.width).toBe('5.2%');

    advance(140);                       // second
    expect(label.textContent).toBe('010%');

    // 100 / 5.2 → 20 ticks, the last at 220 + 19*140 = 2880ms.
    advance(2880 - 360);
    expect(label.textContent).toBe('100%');
    expect(bar.style.width).toBe('100%');

    // And no further ticks were queued once it hit 100.
    advance(1000);
    expect(label.textContent).toBe('100%');
    expect(bar.style.width).toBe('100%');
  });

  it('starts exiting at 4600, not when the bar fills', () => {
    const { container } = render(withSplash(<Splash />));

    advance(4599);
    expect(rootOf(container)).not.toHaveAttribute('data-exiting');

    advance(1);
    expect(rootOf(container)).toHaveAttribute('data-exiting');
  });

  it('arms reveals 320ms after the exit begins, not immediately', () => {
    render(withSplash(<Splash />));

    advance(4600);
    expect(screen.getByTestId('ready')).toHaveTextContent('false');

    advance(319);
    expect(screen.getByTestId('ready')).toHaveTextContent('false');

    advance(1);
    expect(screen.getByTestId('ready')).toHaveTextContent('true');
  });

  it('leaves the DOM 1150ms after the exit begins', () => {
    const { container } = render(withSplash(<Splash />));

    advance(4600 + 1149);
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

    advance(560);
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
  it('a SKIP click after the 4600ms finish does not restart the exit clock', () => {
    const { container } = render(withSplash(<Splash />));

    advance(4600);
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

    advance(4600);
    expect(gated).toHaveAttribute('data-reveal', 'out');

    advance(319);
    expect(gated).toHaveAttribute('data-reveal', 'out');

    advance(1);
    expect(gated).toHaveAttribute('data-reveal', 'in');
  });
});
