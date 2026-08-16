import { render, act } from '@testing-library/react';
import { createRef } from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import GrainOverlay from '../GrainOverlay';
import { ThemeProvider } from '../../../providers/ThemeProvider';

// jsdom implements neither getContext('2d') nor toDataURL(), so both are
// stubbed on the prototype. createImageData returns a real typed array so
// the noise loop actually walks it rather than short-circuiting.
function mockGrainCanvas() {
  const ctx = {
    createImageData: vi.fn((w, h) => ({ data: new Uint8ClampedArray(w * h * 4) })),
    putImageData: vi.fn(),
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
    'data:image/png;base64,MOCK',
  );
  return ctx;
}

const withTheme = (ui) => <ThemeProvider>{ui}</ThemeProvider>;

/** The cross-tab path ThemeProvider listens on — a real theme change. */
function setThemeViaStorage(theme) {
  act(() => {
    localStorage.setItem('pg-theme', theme);
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'pg-theme', newValue: theme }),
    );
  });
}

describe('GrainOverlay (PF-77)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    // setup.js's localStorage mock has a module-level store that never
    // resets on its own — without this a later test starts in whatever
    // theme this one left behind.
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('sets a background-image data URL on mount', () => {
    mockGrainCanvas();
    let node;
    render(withTheme(<GrainOverlay ref={(n) => { node = n; }} />));
    expect(node.style.backgroundImage).toContain('data:image/png;base64,MOCK');
  });

  it('tiles the texture', () => {
    mockGrainCanvas();
    let node;
    render(withTheme(<GrainOverlay ref={(n) => { node = n; }} />));
    expect(node.style.backgroundRepeat).toBe('repeat');
  });

  it('rests at 0.42 opacity after mount, regardless of theme', () => {
    // The prototype's real mount ordering — applyTheme() runs first and
    // sets .13/.45, then paintGrain() overwrites it. Confirmed against
    // source (componentDidMount lines 881 and 884). This assertion is
    // what fails if the two effects are ever reordered.
    mockGrainCanvas();
    localStorage.setItem('pg-theme', 'light');
    let node;
    render(withTheme(<GrainOverlay ref={(n) => { node = n; }} />));
    expect(node.style.opacity).toBe('0.42');
  });

  it('updates to the theme-correct opacity on a later toggle', () => {
    mockGrainCanvas();
    localStorage.setItem('pg-theme', 'dark');
    let node;
    render(withTheme(<GrainOverlay ref={(n) => { node = n; }} />));
    expect(node.style.opacity).toBe('0.42'); // resting value right after mount

    setThemeViaStorage('light');
    // '0.13', not '.13': the component writes the prototype's value
    // verbatim, and the CSSOM normalises the leading-dot form on
    // read-back. Asserting the effective value, not the source text.
    expect(node.style.opacity).toBe('0.13');
  });

  it('uses the dark opacity when toggling back to dark', () => {
    mockGrainCanvas();
    localStorage.setItem('pg-theme', 'light');
    let node;
    render(withTheme(<GrainOverlay ref={(n) => { node = n; }} />));

    setThemeViaStorage('dark');
    expect(node.style.opacity).toBe('0.45'); // normalised — see above
  });

  it('generates the texture exactly once, even across theme toggles', () => {
    // The paint effect's [] deps are load-bearing: regenerating 78,400
    // pixels of noise per toggle would be pure waste, and a fresh random
    // texture on every toggle is a visible grain reshuffle the prototype
    // never does.
    const ctx = mockGrainCanvas();
    render(withTheme(<GrainOverlay />));

    setThemeViaStorage('light');
    setThemeViaStorage('dark');

    expect(ctx.putImageData).toHaveBeenCalledTimes(1);
  });

  it('does not throw when the 2D context is unavailable', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(() => render(withTheme(<GrainOverlay />))).not.toThrow();
  });

  it('carries aria-hidden', () => {
    mockGrainCanvas();
    let node;
    render(withTheme(<GrainOverlay ref={(n) => { node = n; }} />));
    expect(node).toHaveAttribute('aria-hidden', 'true');
  });

  it(`still forwards an external ref, per PF-75's contract`, () => {
    // React 19 passes `ref` through as an ordinary prop, so a component
    // that forgets to destructure it still renders perfectly and hands
    // back null — which would only surface as the grain never painting.
    mockGrainCanvas();
    const ref = createRef();
    render(withTheme(<GrainOverlay ref={ref} />));
    expect(ref.current?.tagName).toBe('DIV');
  });
});
