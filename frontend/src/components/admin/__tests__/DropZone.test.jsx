// PF-113 batch 2 — drag-and-drop for the upload cards.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DropZone } from '../DropZone';

const file = (name) => new File(['x'], name, { type: 'image/png' });
const dt = (files, types = ['Files']) => ({ dataTransfer: { files, types, dropEffect: '' } });

const setup = () => {
  const onFile = vi.fn();
  const onReject = vi.fn();
  render(
    <DropZone onFile={onFile} onReject={onReject}>
      <span data-testid="child">thumb</span>
    </DropZone>,
  );
  return { zone: screen.getByTestId('child').parentElement, onFile, onReject };
};

describe('DropZone', () => {
  it('highlights while a file is dragged over it, and says DROP TO STAGE', () => {
    const { zone } = setup();
    fireEvent.dragEnter(zone, dt([]));
    expect(zone).toHaveAttribute('data-dragging', 'true');
    expect(screen.getByText('DROP TO STAGE')).toBeInTheDocument();
  });

  // ⚠️ dragleave fires for every CHILD crossed; a boolean would flicker off.
  it('stays highlighted while the pointer crosses a child', () => {
    const { zone } = setup();
    fireEvent.dragEnter(zone, dt([]));
    fireEvent.dragEnter(screen.getByTestId('child'), dt([]));
    fireEvent.dragLeave(screen.getByTestId('child'), dt([]));
    expect(zone).toHaveAttribute('data-dragging', 'true');
    fireEvent.dragLeave(zone, dt([]));
    expect(zone).not.toHaveAttribute('data-dragging');
  });

  it('hands ONE dropped file to onFile and clears the highlight', () => {
    const { zone, onFile } = setup();
    const f = file('a.png');
    fireEvent.dragEnter(zone, dt([f]));
    fireEvent.drop(zone, dt([f]));
    expect(onFile).toHaveBeenCalledWith(f);
    expect(zone).not.toHaveAttribute('data-dragging');
  });

  it('refuses several files at once', () => {
    const { zone, onFile, onReject } = setup();
    fireEvent.drop(zone, dt([file('a.png'), file('b.png')]));
    expect(onFile).not.toHaveBeenCalled();
    expect(onReject).toHaveBeenCalledWith('Drop one file at a time.');
  });

  // Dragging TEXT (e.g. selected words) over the card is not an upload.
  it('ignores a drag that carries no files', () => {
    const { zone, onFile } = setup();
    fireEvent.dragEnter(zone, dt([], ['text/plain']));
    expect(zone).not.toHaveAttribute('data-dragging');
    fireEvent.drop(zone, dt([], ['text/plain']));
    expect(onFile).not.toHaveBeenCalled();
  });
});
