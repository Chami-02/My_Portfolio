// frontend/src/components/admin/__tests__/LoadError.test.jsx
//
// PF-117 — what a panel shows when its data could not be loaded. The wording
// is the owner's (2026-10-11): short by default, and a RETRY that fails again
// must say so rather than repeat itself.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { LoadError } from '../LoadError';

const FIRST = 'COULDN’T LOAD YOUR PROJECTS';
const AGAIN = 'STILL CAN’T REACH THE SERVER — TRY AGAIN IN A MINUTE.';

describe('LoadError', () => {
  it('names what failed and offers RETRY, as an alert', () => {
    render(<LoadError what="YOUR PROJECTS" query={{ refetch: vi.fn(), isFetching: false }} />);
    expect(screen.getByRole('alert')).toHaveTextContent(FIRST);
    const retry = screen.getByRole('button', { name: 'RETRY', exact: true });
    // Not a form submit — panels render this beside their forms.
    expect(retry).toHaveAttribute('type', 'button');
    expect(retry).toBeEnabled();
  });

  it('refetches on RETRY and shows it is working', async () => {
    const refetch = vi.fn();
    const { rerender } = render(<LoadError what="YOUR PROJECTS" query={{ refetch, isFetching: false }} />);
    await userEvent.click(screen.getByRole('button', { name: 'RETRY', exact: true }));
    expect(refetch).toHaveBeenCalledTimes(1);

    rerender(<LoadError what="YOUR PROJECTS" query={{ refetch, isFetching: true }} />);
    expect(screen.getByRole('button', { name: 'RETRYING…', exact: true })).toBeDisabled();
    // Still the first sentence while the retry is in flight.
    expect(screen.getByRole('alert')).toHaveTextContent(FIRST);
  });

  it('says so when a RETRY fails again', async () => {
    const refetch = vi.fn();
    const { rerender } = render(<LoadError what="YOUR PROJECTS" query={{ refetch, isFetching: false }} />);
    await userEvent.click(screen.getByRole('button', { name: 'RETRY', exact: true }));
    rerender(<LoadError what="YOUR PROJECTS" query={{ refetch, isFetching: true }} />);
    rerender(<LoadError what="YOUR PROJECTS" query={{ refetch, isFetching: false }} />);

    expect(screen.getByRole('alert')).toHaveTextContent(AGAIN);
    expect(screen.getByRole('alert')).not.toHaveTextContent(FIRST);
    // …and can be pressed again.
    expect(screen.getByRole('button', { name: 'RETRY', exact: true })).toBeEnabled();
  });

  it('never says "still" before the owner has pressed RETRY', () => {
    // A background fetch that comes and goes is not a retry the owner made.
    // Keying on the query's error count would get this wrong after a remount.
    const refetch = vi.fn();
    const { rerender } = render(<LoadError what="YOUR PROJECTS" query={{ refetch, isFetching: true }} />);
    rerender(<LoadError what="YOUR PROJECTS" query={{ refetch, isFetching: false }} />);
    expect(screen.getByRole('alert')).toHaveTextContent(FIRST);
    expect(screen.getByRole('alert')).not.toHaveTextContent(AGAIN);
  });
});
