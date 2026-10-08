import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent }             from '@testing-library/react';
import { ErrorBoundary }                         from '../ErrorBoundary';

// A component that throws on first render only
let shouldThrow = false;
function ThrowingComponent() {
  if (shouldThrow) throw new Error('Test render error');
  return <p>Content rendered fine</p>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    shouldThrow = false;
    // Suppress console.error for expected errors
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <p>Safe content</p>
      </ErrorBoundary>
    );
    expect(screen.getByText('Safe content')).toBeInTheDocument();
  });

  it('renders fallback UI when a child component throws', () => {
    shouldThrow = true;
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('shows a "Try again" button in the fallback UI', () => {
    shouldThrow = true;
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('resets error state when "Try again" is clicked', () => {
    shouldThrow = true;
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(screen.getByText('Content rendered fine')).toBeInTheDocument();
  });

  // ── PF-116 — the fallback moved onto Phase 2 ─────────────────────────

  it('the reset control is type="button", never an implicit submit', () => {
    // A boundary can wrap a <form> (Contact does). A type-less <button>
    // rendered inside a form is a SUBMIT button — see CLAUDE.md's
    // Silent-failures entry from PF-97.
    shouldThrow = true;
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );
    expect(screen.getByRole('button', { name: /try again/i })).toHaveAttribute('type', 'button');
  });

  it('announces the failure and prints the error message', () => {
    shouldThrow = true;
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/something went wrong/i);
    expect(alert).toHaveTextContent('Test render error');
  });

  it('carries no inline style — every colour comes from the module', () => {
    // The Phase 1 fallback was all inline style={{}}: a --text-muted
    // detail line (2.67:1 in dark) and #f87171 reds that never flipped.
    // Inline styles are invisible to the stylesheet guards, which is how
    // they outlived every Phase 1 sweep; pin that none come back.
    shouldThrow = true;
    const { container } = render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );
    expect(container.querySelector('[style]')).toBeNull();
  });
});
