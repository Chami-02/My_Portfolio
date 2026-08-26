import { render, screen, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SplashProvider } from '../SplashProvider';
import { useSplashReady } from '../../hooks/useSplashReady';
import { useSplashControls } from '../../hooks/useSplashControls';

function ReadyProbe() {
  return <span data-testid="ready">{String(useSplashReady())}</span>;
}

function ToggleButtons() {
  const { setReady } = useSplashControls();
  return (
    <>
      <button onClick={() => setReady(false)}>hide</button>
      <button onClick={() => setReady(true)}>show</button>
    </>
  );
}

describe('SplashProvider (PF-75)', () => {

  // Fails open, unlike ThemeProvider/MotionProvider. Admin and Blog have
  // no splash and never will, and every Reveal/CountUp usage that
  // predates PF-75 renders with no SplashProvider above it.
  it('defaults to ready with no provider at all', () => {
    render(<ReadyProbe />);
    expect(screen.getByTestId('ready')).toHaveTextContent('true');
  });

  it('does not throw outside a provider', () => {
    expect(() => render(<ReadyProbe />)).not.toThrow();
  });

  it('starts ready inside a provider', () => {
    render(<SplashProvider><ReadyProbe /></SplashProvider>);
    expect(screen.getByTestId('ready')).toHaveTextContent('true');
  });

  it('reflects setReady in both directions', () => {
    render(
      <SplashProvider>
        <ReadyProbe />
        <ToggleButtons />
      </SplashProvider>,
    );

    act(() => { screen.getByText('hide').click(); });
    expect(screen.getByTestId('ready')).toHaveTextContent('false');

    act(() => { screen.getByText('show').click(); });
    expect(screen.getByTestId('ready')).toHaveTextContent('true');
  });

  // ── initialReady, added in PF-78 ────────────────────────────────────
  //
  // The point is that ready is false on the FIRST render, not corrected
  // to false a render later. Nothing above this line passes the prop, so
  // every test before it doubles as the backward-compatibility check.

  it('starts unready when initialReady={false}', () => {
    render(
      <SplashProvider initialReady={false}>
        <ReadyProbe />
      </SplashProvider>,
    );
    expect(screen.getByTestId('ready')).toHaveTextContent('false');
  });

  it('still defaults to ready when initialReady is omitted', () => {
    render(<SplashProvider><ReadyProbe /></SplashProvider>);
    expect(screen.getByTestId('ready')).toHaveTextContent('true');
  });

  // initialReady seeds useState and nothing more. A later prop change
  // must NOT push a new value in — the splash owns readiness once it is
  // running, and a re-render that reset it would fight setReady.
  it('ignores a later change to initialReady', () => {
    const { rerender } = render(
      <SplashProvider initialReady={false}>
        <ReadyProbe />
        <ToggleButtons />
      </SplashProvider>,
    );

    act(() => { screen.getByText('show').click(); });
    expect(screen.getByTestId('ready')).toHaveTextContent('true');

    rerender(
      <SplashProvider initialReady={false}>
        <ReadyProbe />
        <ToggleButtons />
      </SplashProvider>,
    );
    expect(screen.getByTestId('ready')).toHaveTextContent('true');
  });

});
