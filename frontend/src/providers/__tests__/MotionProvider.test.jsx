// frontend/src/providers/__tests__/MotionProvider.test.jsx
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MotionProvider } from '../MotionProvider';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { MOTION_ATTR } from '../../utils/motion';

function mockMatchMedia(matches) {
  const listeners = new Set();
  const mq = {
    matches,
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
    _fire: (next) => {
      mq.matches = next;
      listeners.forEach((fn) => fn({ matches: next }));
    },
  };
  vi.stubGlobal('matchMedia', vi.fn(() => mq));
  return mq;
}

function Probe() {
  const reduced = useReducedMotion();
  return <span data-testid="reduced">{String(reduced)}</span>;
}

describe('MotionProvider (PF-73)', () => {

  beforeEach(() => {
    document.documentElement.removeAttribute(MOTION_ATTR);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports false and sets no attribute by default', () => {
    mockMatchMedia(false);
    render(<MotionProvider><Probe /></MotionProvider>);

    expect(screen.getByTestId('reduced')).toHaveTextContent('false');
    expect(document.documentElement.hasAttribute(MOTION_ATTR)).toBe(false);
  });

  it('reports true and sets the attribute when the OS prefers reduced', () => {
    mockMatchMedia(true);
    render(<MotionProvider><Probe /></MotionProvider>);

    expect(screen.getByTestId('reduced')).toHaveTextContent('true');
    expect(document.documentElement.getAttribute(MOTION_ATTR)).toBe('reduced');
  });

  it('responds to the preference changing while mounted', () => {
    const mq = mockMatchMedia(false);
    render(<MotionProvider><Probe /></MotionProvider>);

    expect(screen.getByTestId('reduced')).toHaveTextContent('false');

    act(() => { mq._fire(true); });

    expect(screen.getByTestId('reduced')).toHaveTextContent('true');
    expect(document.documentElement.getAttribute(MOTION_ATTR)).toBe('reduced');
  });

  it('throws when the hook is used outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/within a MotionProvider/);
    spy.mockRestore();
  });

});
