// PF-113 — the shared destructive-action confirm.
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ConfirmDialog } from '../ConfirmDialog';

const renderDialog = (props = {}) => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmDialog title="Delete project?" onConfirm={onConfirm} onCancel={onCancel} {...props}>
      This cannot be undone.
    </ConfirmDialog>,
  );
  return { onConfirm, onCancel };
};

describe('ConfirmDialog', () => {
  it('is a labelled modal dialog with the prototype\'s copy', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog', { name: 'Delete project?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'YES, DELETE' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CANCEL' })).toBeInTheDocument();
  });

  // Enter pressed out of habit must not do the irreversible thing.
  it('focuses CANCEL, not the destructive button', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: 'CANCEL' })).toHaveFocus();
  });

  it('returns focus to whatever opened it', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const { unmount } = render(
      <ConfirmDialog title="t" onConfirm={() => {}} onCancel={() => {}}>b</ConfirmDialog>,
    );
    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });

  // ⚠️ Load-bearing: the vocabulary picker renders this INSIDE a record's <form>.
  it('submits no surrounding form', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((e) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <ConfirmDialog title="t" onConfirm={() => {}} onCancel={() => {}}>b</ConfirmDialog>
      </form>,
    );
    await user.click(screen.getByRole('button', { name: 'YES, DELETE' }));
    await user.click(screen.getByRole('button', { name: 'CANCEL' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('YES and CANCEL call their handlers', async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = renderDialog();
    await user.click(screen.getByRole('button', { name: 'YES, DELETE' }));
    await user.click(screen.getByRole('button', { name: 'CANCEL' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Escape and a backdrop click cancel; a click inside the card does not', () => {
    const { onCancel } = renderDialog();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('dialog'));
    fireEvent.click(screen.getByText('This cannot be undone.'));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('while busy: the label changes, both buttons lock, Escape is ignored', () => {
    const { onCancel } = renderDialog({ busy: true });
    expect(screen.getByRole('button', { name: 'DELETING…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'CANCEL' })).toBeDisabled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('confirmDisabled locks only the destructive button', () => {
    renderDialog({ confirmDisabled: true });
    expect(screen.getByRole('button', { name: 'YES, DELETE' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'CANCEL' })).toBeEnabled();
  });
});
