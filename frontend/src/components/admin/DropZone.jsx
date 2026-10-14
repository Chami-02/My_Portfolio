import { useRef, useState } from 'react';
import a from '../../styles/admin.module.css';

/**
 * Drag-and-drop for an upload card (PF-113 batch 2, owner request).
 *
 * A MOUSE convenience laid over the existing upload pill — the pill stays, and
 * stays the keyboard and screen-reader route, so this adds no tab stop and no
 * role of its own.
 *
 * ⚠️ `onFile` must be the SAME handler the pill calls (`prepareFile` →
 * stage). A drop skips the file picker's `accept` filter entirely, so if drops
 * took a shortcut the type check would only exist for the button.
 *
 * ⚠️ The depth counter is what stops the highlight flickering. `dragenter` /
 * `dragleave` fire for every CHILD the pointer crosses, so a plain boolean
 * turns off the moment the pointer passes over the thumbnail inside the zone.
 */
export function DropZone({ onFile, onReject, className = '', children }) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);

  const carriesFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files');

  return (
    <div
      className={`${a.dropZone} ${className}`.trim()}
      data-dragging={over ? 'true' : undefined}
      onDragEnter={(e) => {
        if (!carriesFiles(e)) return;
        e.preventDefault();
        depth.current += 1;
        setOver(true);
      }}
      onDragOver={(e) => {
        if (!carriesFiles(e)) return;
        // Without preventDefault on dragover the browser refuses the drop.
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={(e) => {
        if (!carriesFiles(e)) return;
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setOver(false);
      }}
      onDrop={(e) => {
        if (!carriesFiles(e)) return;
        e.preventDefault();
        depth.current = 0;
        setOver(false);
        const files = e.dataTransfer.files;
        if (files.length !== 1) onReject('Drop one file at a time.');
        else onFile(files[0]);
      }}
    >
      {children}
      {over && <span className={a.dropHint} aria-hidden="true">DROP TO STAGE</span>}
    </div>
  );
}
