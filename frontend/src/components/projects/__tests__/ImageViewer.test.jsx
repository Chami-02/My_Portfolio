// PF-144 part 2 — the section-picture big view (owner, 2026-11-03: "like
// certificate"; closes on Esc and on a click OUTSIDE the picture).
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ImageViewer } from '../ImageViewer';

const IMAGES = Object.freeze([
  { url: 'https://res.cloudinary.com/x/image/upload/v1/a.png', caption: 'Dashboard', width: 1920, height: 1080 },
  { url: 'https://res.cloudinary.com/x/image/upload/v1/b.png', caption: '', width: 1920, height: 1080 },
  { url: 'https://res.cloudinary.com/x/image/upload/v1/c.png', caption: 'Phone', width: 1080, height: 1920 },
]);

const open = (props = {}) => {
  const onClose = vi.fn();
  render(<ImageViewer images={IMAGES} start={0} heading="Key Features" onClose={onClose} {...props} />);
  return onClose;
};

describe('ImageViewer', () => {
  it('a modal dialog named by the section, focus on ×, the page locked', () => {
    open();
    expect(screen.getByRole('dialog', { name: 'Key Features' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    expect(document.documentElement.style.overflow).toBe('hidden');
  });

  it('shows the clicked picture big, with its caption as its name, and "1 / 3"', () => {
    open();
    expect(screen.getByRole('img', { name: 'Dashboard' }).getAttribute('src')).toContain('w_1920');
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('a picture with no caption is named "<heading> — picture N"', () => {
    open({ start: 1 });
    expect(screen.getByRole('img', { name: 'Key Features — picture 2' })).toBeInTheDocument();
  });

  it('closes on Esc', () => {
    const onClose = open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on a click on the dark background — NOT on a click on the picture', async () => {
    const onClose = open();
    const user = userEvent.setup();
    await user.click(screen.getByRole('img', { name: 'Dashboard' }));
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on ×', async () => {
    const onClose = open();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('← → and PREV / NEXT step through the section, stopping at the ends', async () => {
    open();
    expect(screen.getByRole('button', { name: 'Previous picture' })).toBeDisabled();
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Next picture' }));
    expect(screen.getByRole('img', { name: 'Phone' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next picture' })).toBeDisabled();
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('one picture: no counter, no arrows', () => {
    open({ images: [IMAGES[0]] });
    expect(screen.queryByText('1 / 1')).toBeNull();
    expect(screen.queryByRole('button', { name: /picture/ })).toBeNull();
  });

  it('gives focus back to the element PASSED as opener (Safari does not focus a clicked button)', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    const { unmount } = render(<ImageViewer images={IMAGES} heading="H" onClose={() => {}} opener={opener} />);
    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it('gives focus back to the opener and unlocks the page when it closes', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const { unmount } = render(<ImageViewer images={IMAGES} heading="H" onClose={() => {}} />);
    unmount();
    expect(opener).toHaveFocus();
    expect(document.documentElement.style.overflow).toBe('');
    opener.remove();
  });
});
