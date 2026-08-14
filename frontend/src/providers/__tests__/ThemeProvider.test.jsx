import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ThemeProvider } from '../ThemeProvider';
import { useTheme } from '../../hooks/useTheme';
import { THEME_KEY } from '../../utils/theme';

function Probe() {
  const { theme, isLight, toggle } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="is-light">{String(isLight)}</span>
      <button onClick={toggle}>toggle</button>
    </div>
  );
}

const renderWithProvider = () =>
  render(<ThemeProvider><Probe /></ThemeProvider>);

describe('ThemeProvider (PF-72)', () => {

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('initialises from the attribute the head script applied', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    renderWithProvider();
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
  });

  it('defaults to dark when nothing is applied', () => {
    renderWithProvider();
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
  });

  it('toggles, applies and persists', async () => {
    const user = userEvent.setup();
    document.documentElement.setAttribute('data-theme', 'dark');
    renderWithProvider();

    await user.click(screen.getByText('toggle'));

    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
  });

  it('exposes isLight correctly', async () => {
    const user = userEvent.setup();
    renderWithProvider();

    expect(screen.getByTestId('is-light')).toHaveTextContent('false');
    await user.click(screen.getByText('toggle'));
    expect(screen.getByTestId('is-light')).toHaveTextContent('true');
  });

  // Cross-tab: applies without persisting. Writing here would make
  // two tabs echo each other indefinitely.
  it('applies a theme change from another tab', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    renderWithProvider();

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: THEME_KEY,
        newValue: 'light',
      }));
    });

    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('ignores storage events for other keys', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    renderWithProvider();

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'something-else',
        newValue: 'light',
      }));
    });

    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
  });

  it('reconciles when the attribute disagrees with storage', () => {
    // Head script failed or was blocked
    localStorage.setItem(THEME_KEY, 'light');
    document.documentElement.setAttribute('data-theme', 'dark');

    renderWithProvider();

    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('throws when useTheme is used outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/within a ThemeProvider/);
    spy.mockRestore();
  });

});
