import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Reveal from '../Reveal';
import { MotionProvider } from '../../../providers/MotionProvider';

/** Controllable IntersectionObserver stub — jsdom has none. */
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
    trigger(isIntersecting) { this.cb([{ isIntersecting }]); }
  }

  vi.stubGlobal('IntersectionObserver', IO);
  return instances;
}

function mockMatchMedia(matches) {
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches,
    addEventListener: () => {},
    removeEventListener: () => {},
  })));
}

const withMotion = (ui) => render(<MotionProvider>{ui}</MotionProvider>);

describe('Reveal (PF-74)', () => {

  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('starts hidden and reveals when intersecting', () => {
    mockMatchMedia(false);
    const ios = mockIO();

    withMotion(<Reveal data-testid="r">content</Reveal>);
    expect(screen.getByTestId('r')).toHaveAttribute('data-reveal', 'out');

    act(() => { ios[0].trigger(true); });
    expect(screen.getByTestId('r')).toHaveAttribute('data-reveal', 'in');
  });

  it('disconnects the observer once revealed', () => {
    mockMatchMedia(false);
    const ios = mockIO();

    withMotion(<Reveal>content</Reveal>);
    act(() => { ios[0].trigger(true); });

    expect(ios[0].disconnected).toBe(true);
  });

  it('starts revealed under reduced motion', () => {
    mockMatchMedia(true);
    mockIO();

    withMotion(<Reveal data-testid="r">content</Reveal>);
    expect(screen.getByTestId('r')).toHaveAttribute('data-reveal', 'in');
  });

  it('applies no transition delay under reduced motion', () => {
    mockMatchMedia(true);
    mockIO();

    withMotion(<Reveal data-testid="r" delay={300}>content</Reveal>);
    expect(screen.getByTestId('r').style.transitionDelay).toBe('');
  });

  it('applies the stagger delay when motion is enabled', () => {
    mockMatchMedia(false);
    mockIO();

    withMotion(<Reveal data-testid="r" delay={300}>content</Reveal>);
    expect(screen.getByTestId('r').style.transitionDelay).toBe('300ms');
  });

  // Matches the prototype's shared reveal/count-up observer exactly
  // (Portfolio Revolution.dc.html startReveals()) — a -8% rootMargin
  // or a 0.3 threshold would silently change when content appears.
  it('observes with the threshold and rootMargin transcribed from the prototype', () => {
    mockMatchMedia(false);
    const ios = mockIO();

    withMotion(<Reveal>content</Reveal>);

    expect(ios[0].opts).toEqual({ threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  });

  it('defaults to the "up" entrance type', () => {
    mockMatchMedia(false);
    mockIO();

    withMotion(<Reveal data-testid="r">content</Reveal>);
    expect(screen.getByTestId('r')).toHaveAttribute('data-type', 'up');
  });

  it.each(['up', 'pop', 'rise', 'left'])('applies data-type="%s"', (type) => {
    mockMatchMedia(false);
    mockIO();

    withMotion(<Reveal data-testid="r" type={type}>content</Reveal>);
    expect(screen.getByTestId('r')).toHaveAttribute('data-type', type);
  });

  // THE SAFETY SWEEP FIX — the prototype leaves this running forever.
  it('clears the safety sweep once revealed', () => {
    mockMatchMedia(false);
    const ios = mockIO();
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');

    withMotion(<Reveal>content</Reveal>);
    act(() => { ios[0].trigger(true); });

    expect(clearSpy).toHaveBeenCalled();
  });

  it('clears the safety sweep on unmount', () => {
    mockMatchMedia(false);
    mockIO();
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');

    const { unmount } = withMotion(<Reveal>content</Reveal>);
    unmount();

    expect(clearSpy).toHaveBeenCalled();
  });

  it('reveals immediately when IntersectionObserver is unavailable', () => {
    mockMatchMedia(false);
    vi.stubGlobal('IntersectionObserver', undefined);

    withMotion(<Reveal data-testid="r">content</Reveal>);
    expect(screen.getByTestId('r')).toHaveAttribute('data-reveal', 'in');
  });

  it('renders the requested element type', () => {
    mockMatchMedia(false);
    mockIO();

    withMotion(<Reveal as="section" data-testid="r">content</Reveal>);
    expect(screen.getByTestId('r').tagName).toBe('SECTION');
  });

});
