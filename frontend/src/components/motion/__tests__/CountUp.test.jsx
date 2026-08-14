import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CountUp from '../CountUp';
import { MotionProvider } from '../../../providers/MotionProvider';

function mockIO() {
  const instances = [];
  class IO {
    constructor(cb, opts) { this.cb = cb; this.opts = opts; instances.push(this); }
    observe() {}
    disconnect() {}
    trigger(v) { this.cb([{ isIntersecting: v }]); }
  }
  vi.stubGlobal('IntersectionObserver', IO);
  return instances;
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
