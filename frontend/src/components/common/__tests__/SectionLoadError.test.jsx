// PF-144 — a home section's "didn't load — TRY AGAIN" line (owner, 2026-11-03).
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SectionLoadError } from '../SectionLoadError';

describe('SectionLoadError', () => {
  it('says what did not load, calmly (role="status"), with TRY AGAIN', () => {
    render(<SectionLoadError what="The projects" retry={() => {}} busy={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('The projects didn’t load. This is usually temporary.');
    expect(screen.getByRole('button', { name: 'TRY AGAIN' })).toBeEnabled();
  });

  it('TRY AGAIN runs the retry; while it runs the button says so and waits', async () => {
    const retry = vi.fn();
    const { rerender } = render(<SectionLoadError what="The skills" retry={retry} busy={false} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'TRY AGAIN' }));
    expect(retry).toHaveBeenCalledTimes(1);
    rerender(<SectionLoadError what="The skills" retry={retry} busy />);
    expect(screen.getByRole('button', { name: 'TRYING AGAIN…' })).toBeDisabled();
  });

  // The admin LoadError rule: a retry that fails again must SAY so.
  it('a retry that fails again says "still"', async () => {
    const { rerender } = render(<SectionLoadError what="The skills" retry={() => {}} busy={false} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'TRY AGAIN' }));
    rerender(<SectionLoadError what="The skills" retry={() => {}} busy={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('The skills still didn’t load. Please try again in a minute.');
  });
});
