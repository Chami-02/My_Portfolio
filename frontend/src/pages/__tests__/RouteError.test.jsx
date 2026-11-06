// PF-149 — the router's error screen: plain words, never React Router's developer page.
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MotionProvider } from '../../providers/MotionProvider';
import { ThemeProvider } from '../../providers/ThemeProvider';
import { RouteError } from '../RouteError';

const Thrower = ({ message }) => { throw new Error(message); };

const renderFailing = (message) => {
  const router = createMemoryRouter([
    { path: '*', element: <Thrower message={message} />, errorElement: <RouteError /> },
  ]);
  return render(<ThemeProvider><MotionProvider><RouterProvider router={router} /></MotionProvider></ThemeProvider>);
};

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());

describe('RouteError', () => {
  // The wording differs per browser: Chrome, Firefox, Safari, then a build tool's.
  it.each([
    'Failed to fetch dynamically imported module: http://x/AdminPage.jsx',
    'error loading dynamically imported module',
    'Importing a module script failed.',
    'Loading chunk 12 failed',
  ])('explains a file that did not arrive: %s', (message) => {
    renderFailing(message);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('This page didn’t load');
    expect(screen.getByText(/ad blocker/)).toBeInTheDocument();
    expect(screen.queryByText(/AdminPage/)).not.toBeInTheDocument();
  });

  it('any other failure gets the plain sentence, never the raw error', () => {
    renderFailing('Cannot read properties of undefined (reading "x")');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Something went wrong');
    expect(screen.getByText(/on our side/)).toBeInTheDocument();
    expect(screen.queryByText(/Cannot read/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Hey developer/)).not.toBeInTheDocument();
  });

  it('offers a way out', () => {
    renderFailing('Loading chunk 1 failed');
    expect(screen.getByRole('button', { name: 'RELOAD' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'GO HOME' })).toHaveAttribute('href', '/');
  });

  it('keeps the raw error for the console', () => {
    renderFailing('Loading chunk 1 failed');
    expect(console.error).toHaveBeenCalledWith('Route error:', expect.any(Error));
  });
});
