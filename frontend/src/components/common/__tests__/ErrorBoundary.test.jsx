import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent }             from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
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

  it('resets error state when "Try again" is clicked', async () => {
    shouldThrow = true;
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByText('Content rendered fine')).toBeInTheDocument();
  });

  /**
   * The bad payload is in the CACHE, fresh (staleTime Infinity), so nothing
   * would refetch it on its own. Before the fix TRY AGAIN re-rendered from
   * that cache and threw again; now it refetches first and gets the good one.
   */
  it('TRY AGAIN refetches a bad cached payload instead of re-throwing it', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    client.setQueryData(['section'], { broken: true });
    const queryFn = vi.fn(async () => ({ broken: false }));

    function Section() {
      const { data } = useQuery({ queryKey: ['section'], queryFn });
      if (data?.broken) throw new Error('Unexpected payload');
      return <p>Fresh content</p>;
    }

    render(
      <QueryClientProvider client={client}>
        <ErrorBoundary><Section /></ErrorBoundary>
      </QueryClientProvider>
    );
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(queryFn).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByText('Fresh content')).toBeInTheDocument();
    expect(queryFn).toHaveBeenCalledTimes(1);
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
