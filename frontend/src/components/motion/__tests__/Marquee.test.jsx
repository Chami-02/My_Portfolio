import { render, screen } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import Marquee from '../Marquee';
import { MotionProvider } from '../../../providers/MotionProvider';

function mockMatchMedia(matches) {
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches, addEventListener: () => {}, removeEventListener: () => {},
  })));
}

const withMotion = (ui) => render(<MotionProvider>{ui}</MotionProvider>);

describe('Marquee (PF-74)', () => {

  afterEach(() => { vi.unstubAllGlobals(); });

  // The marq keyframe translates -50%, which assumes two copies.
  // One copy and the strip visibly jumps every cycle.
  it('renders its content twice', () => {
    mockMatchMedia(false);
    withMotion(<Marquee>REPEATED</Marquee>);

    expect(screen.getAllByText('REPEATED')).toHaveLength(2);
  });

  it('is hidden from assistive technology', () => {
    mockMatchMedia(false);
    const { container } = withMotion(<Marquee>x</Marquee>);

    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies the duration', () => {
    mockMatchMedia(false);
    const { container } = withMotion(<Marquee duration={20}>x</Marquee>);

    const track = container.firstChild.firstChild;
    expect(track.style.animationDuration).toBe('20s');
  });

  it('reverses direction when asked', () => {
    mockMatchMedia(false);
    const { container } = withMotion(<Marquee reverse>x</Marquee>);

    const track = container.firstChild.firstChild;
    expect(track.style.animationDirection).toBe('reverse');
  });

  it('applies no inline animation under reduced motion', () => {
    mockMatchMedia(true);
    const { container } = withMotion(<Marquee duration={20}>x</Marquee>);

    const track = container.firstChild.firstChild;
    expect(track.style.animationDuration).toBe('');
  });

});
