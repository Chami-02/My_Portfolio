import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import CountUp from '../CountUp';
import { MotionProvider } from '../../../providers/MotionProvider';
import { SplashProvider } from '../../../providers/SplashProvider';
import { useSplashControls } from '../../../hooks/useSplashControls';

function mockIO() {
  const instances = [];
  class IO {
    constructor(cb, opts) {
      this.cb = cb;
      this.opts = opts;
      this.disconnected = false;
      instances.push(this);
    }
    observe() {}
    disconnect() { this.disconnected = true; }
    trigger(v) { this.cb([{ isIntersecting: v }]); }
  }
  vi.stubGlobal('IntersectionObserver', IO);
  return instances;
}

/**
 * Controllable requestAnimationFrame — the splash-gate tests need to
 * drive the count manually after re-arming. Matches Reveal's mockIO in
 * spirit: collect the callbacks, fire them on demand.
 */
function mockRaf() {
  const frames = [];
  vi.stubGlobal('requestAnimationFrame', (cb) => {
    frames.push(cb);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  return { tick: (now) => act(() => { frames.shift()?.(now); }) };
}

function mockMatchMedia(matches) {
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches, addEventListener: () => {}, removeEventListener: () => {},
  })));
}

const withMotion = (ui) => render(<MotionProvider>{ui}</MotionProvider>);

describe('CountUp (PF-74)', () => {

  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('starts at zero before intersecting', () => {
    mockMatchMedia(false);
    mockIO();

    withMotion(<CountUp to={50} data-testid="c" />);
    expect(screen.getByTestId('c')).toHaveTextContent('0');
  });

  it('shows the final value immediately under reduced motion', () => {
    mockMatchMedia(true);
    mockIO();

    withMotion(<CountUp to={50} data-testid="c" />);
    expect(screen.getByTestId('c')).toHaveTextContent('50');
  });

  it('renders the suffix', () => {
    mockMatchMedia(true);
    mockIO();

    withMotion(<CountUp to={50} suffix="+" data-testid="c" />);
    expect(screen.getByTestId('c')).toHaveTextContent('50+');
  });

  it('respects the decimals prop', () => {
    mockMatchMedia(true);
    mockIO();

    withMotion(<CountUp to={4.5} decimals={1} data-testid="c" />);
    expect(screen.getByTestId('c')).toHaveTextContent('4.5');
  });

  // The prototype observes data-count elements with the same
  // observer (and options) it uses for data-reveal.
  it('observes with the threshold and rootMargin transcribed from the prototype', () => {
    mockMatchMedia(false);
    const ios = mockIO();

    withMotion(<CountUp to={50} />);

    expect(ios[0].opts).toEqual({ threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  });

  it('lands exactly on the target after the full duration', () => {
    mockMatchMedia(false);
    const ios = mockIO();

    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    const frames = [];
    vi.stubGlobal('requestAnimationFrame', (cb) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});

    withMotion(<CountUp to={50} data-testid="c" />);
    act(() => { ios[0].trigger(true); });

    // First frame at t=0, final frame past the 1300ms duration
    act(() => { frames.shift()?.(0); });
    act(() => { frames.shift()?.(1400); });

    expect(screen.getByTestId('c')).toHaveTextContent('50');
  });

});

/** Drives the splash gate from inside the provider. */
function ToggleButtons() {
  const { setReady } = useSplashControls();
  return (
    <>
      <button onClick={() => setReady(false)}>hide</button>
      <button onClick={() => setReady(true)}>show</button>
    </>
  );
}

// CountUp still needs MotionProvider here — useReducedMotion throws
// without one, so the splash provider goes *inside* withMotion.
const withSplash = (ui) => withMotion(<SplashProvider>{ui}</SplashProvider>);

describe('CountUp — splash gate (PF-75)', () => {

  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('does not count while blocked by the splash', () => {
    mockMatchMedia(false);
    const ios = mockIO();

    withSplash(
      <>
        <ToggleButtons />
        <CountUp to={50} data-testid="c" />
      </>,
    );

    act(() => { screen.getByText('hide').click(); });

    expect(ios[0].disconnected).toBe(true);
    expect(screen.getByTestId('c')).toHaveTextContent('0');
  });

  it('re-arms and counts once the splash becomes ready again', () => {
    mockMatchMedia(false);
    const ios = mockIO();
    const raf = mockRaf();

    withSplash(
      <>
        <ToggleButtons />
        <CountUp to={50} data-testid="c" />
      </>,
    );

    act(() => { screen.getByText('hide').click(); });
    act(() => { screen.getByText('show').click(); });

    // A second observer instance for the re-armed effect.
    expect(ios).toHaveLength(2);

    act(() => { ios[1].trigger(true); });
    raf.tick(0);
    raf.tick(1400);

    expect(screen.getByTestId('c')).toHaveTextContent('50');
  });

});
