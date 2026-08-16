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

});
