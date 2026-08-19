import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { render, act } from '@testing-library/react';
import { createRef } from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import CursorGlow from '../CursorGlow';

// No provider wrapping needed — unlike StarfieldCanvas and GrainOverlay,
// this component calls no hooks that require one. That is itself a
// confirming signal that the ticket's "no splash / no reduced-motion
// gate" decision is actually reflected in the code.

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, '../CursorGlow.module.css'), 'utf8')
  // Strip comments first — the header comment names both values in
  // prose, and a prose example read as a real declaration is exactly
  // how PF-67 got a false pass.
  .replace(/\/\*[\s\S]*?\*\//g, '');

const move = (clientX, clientY) => {
  act(() => {
    window.dispatchEvent(new MouseEvent('pointermove', { clientX, clientY }));
  });
};

describe('CursorGlow (PF-77)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // The resting-invisible state is a CSS class rule, not an inline
  // style, and this project's Vitest config does not process CSS — CSS
  // Modules are stubbed, so no stylesheet is ever applied in jsdom and
  // getComputedStyle would report the initial value either way. The
  // stylesheet is therefore asserted as text, the same way
  // styles/__tests__/tokens.css and keyframes.css are, and the DOM
  // assertion below covers the half that is the component's own job:
  // writing nothing inline until the pointer actually moves.
  it('declares the resting-invisible state and the fade in its stylesheet', () => {
    expect(css).toMatch(/opacity:\s*0\s*;/);
    expect(css).toMatch(/transition:\s*opacity\s+260ms\s+ease\s*;/);
  });

  it('writes no inline opacity before the first pointermove', () => {
    let node;
    render(<CursorGlow ref={(n) => { node = n; }} />);
    // Nothing inline yet, so the class's opacity: 0 is what governs —
    // a component that set opacity eagerly on mount would defeat the
    // transition and flash the glow at its untransformed (0,0) corner.
    expect(node.style.opacity).toBe('');
    expect(node.style.transform).toBe('');
  });

  it('becomes visible and tracks on the first pointermove', () => {
    let node;
    render(<CursorGlow ref={(n) => { node = n; }} />);

    move(120, 80);

    expect(node.style.opacity).toBe('1');
    expect(node.style.transform).toBe('translate3d(120px,80px,0)');
  });

  it('keeps tracking on later moves', () => {
    let node;
    render(<CursorGlow ref={(n) => { node = n; }} />);

    move(10, 10);
    move(200, 150);

    expect(node.style.transform).toBe('translate3d(200px,150px,0)');
    expect(node.style.opacity).toBe('1');
  });

  it('writes the opacity once, not on every move', () => {
    // Guards the hasMoved latch. Overwriting opacity every event would
    // still look right, so nothing else here would catch its removal.
    let node;
    render(<CursorGlow ref={(n) => { node = n; }} />);

    move(10, 10);
    node.style.opacity = '0.5'; // stand-in for "something else owns this now"
    move(20, 20);

    expect(node.style.opacity).toBe('0.5');
  });

  it('does not reset on pointerleave — no such handler exists, by design', () => {
    // Confirmed absent from the prototype: unlike the star field, which
    // resets its cursor to (-9999,-9999) on leave, the glow just stays
    // where it was. Transcribed as-is.
    let node;
    render(<CursorGlow ref={(n) => { node = n; }} />);

    move(50, 50);
    act(() => {
      window.dispatchEvent(new MouseEvent('pointerleave'));
    });

    expect(node.style.transform).toBe('translate3d(50px,50px,0)');
    expect(node.style.opacity).toBe('1');
  });

  it('removes its listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<CursorGlow />);
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('pointermove', expect.any(Function));
  });

  it('carries aria-hidden', () => {
    let node;
    render(<CursorGlow ref={(n) => { node = n; }} />);
    expect(node).toHaveAttribute('aria-hidden', 'true');
  });

  it(`still forwards an external ref, per PF-75's contract`, () => {
    // React 19 passes `ref` through as an ordinary prop, so a component
    // that forgets to destructure it still renders perfectly and hands
    // back null — which here would mean the glow silently never moves.
    const ref = createRef();
    render(<CursorGlow ref={ref} />);
    expect(ref.current?.tagName).toBe('DIV');
  });
});
