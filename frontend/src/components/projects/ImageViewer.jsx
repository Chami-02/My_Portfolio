import { useEffect, useRef, useState } from 'react';
import { pictureAt } from '../../utils/projectMeta';
import styles from './ImageViewer.module.css';

/**
 * PF-144 part 2 — a section picture, maximised over the page (owner,
 * 2026-11-03: "like certificate"). The Certificates big view's behaviour and
 * look (`CertificateView`, pages/CertificatesPage.jsx), without a route: a
 * section's pictures are part of the project page, not addresses of their own.
 *
 * Closes on ×, on Esc, and on a click on the dark background OUTSIDE the
 * panel. ⚠️ The overlay root IS the backdrop and the click test is
 * `target === currentTarget` — two stacked full-size layers would let only
 * the top one get clicks (CLAUDE.md silent failures), and a click on the
 * picture itself must not close it.
 *
 * With 2+ pictures: ← → keys and PREV / NEXT step through THIS section's
 * pictures, "2 / 3" announced. Focus starts on × and is kept inside (Tab
 * wraps); on close it returns to the picture that opened it. The page under
 * it does not scroll while it is open.
 *
 * @param images   the section's pictures `{ url, caption, width, height }`
 * @param start    which one was clicked
 * @param heading  the section's heading — the dialog's name
 * @param opener   the element that opened it, to give focus back to. Passed
 *                 explicitly: Safari does not focus a button on click, so
 *                 "whatever had focus" is not the picture there.
 */
export function ImageViewer({ images, start = 0, heading, onClose, opener: openerProp }) {
  const [index, setIndex] = useState(start);
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  // Read once, at open — the effect below runs once.
  const openerRef = useRef(openerProp);
  const image = images[index];
  const many = images.length > 1;

  // The latest callbacks, for ONE keydown listener registered once.
  const keys = useRef(null);
  useEffect(() => {
    keys.current = {
      close: onClose,
      prev: () => setIndex((i) => Math.max(0, i - 1)),
      next: () => setIndex((i) => Math.min(images.length - 1, i + 1)),
    };
  });
  useEffect(() => {
    const onKey = (e) => {
      const k = keys.current;
      if (!k) return;
      if (e.key === 'Escape') { e.preventDefault(); k.close(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); k.prev(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); k.next(); }
      else if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll('button:not([disabled])');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Lock the page, focus ×, and give focus back to the opener on close.
  useEffect(() => {
    const opener = openerRef.current ?? document.activeElement;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      root.style.overflow = before;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  // Fetch the neighbours ahead, so stepping never shows an empty frame.
  useEffect(() => {
    [images[index - 1], images[index + 1]].forEach((img) => {
      if (img?.url) { const pre = new Image(); pre.src = pictureAt(img.url, 1920); }
    });
  }, [images, index]);

  if (!image) return null;
  const titleId = 'image-viewer-title';
  const alt = image.caption || `${heading} — picture ${index + 1}`;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={styles.panel} ref={panelRef}>
        <div className={styles.panelBar}>
          <h2 id={titleId} className={styles.title}>{heading}</h2>
          {many && <span className={styles.counter} aria-live="polite">{index + 1} / {images.length}</span>}
          <span className={styles.spacer} />
          <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className={styles.viewFrame}>
          <img
            key={image.url}
            className={styles.viewPicture}
            src={pictureAt(image.url, 1920)}
            // A phone picks a smaller file (often the one the page already
            // fetched) instead of always pulling the 1920px one.
            srcSet={[900, 1640, 1920].map((w) => `${pictureAt(image.url, w)} ${w}w`).join(', ')}
            sizes="(max-width: 560px) 100vw, 940px"
            alt={alt}
            {...(image.width && image.height && { width: image.width, height: image.height })}
          />
        </div>
        {image.caption && <p className={styles.caption}>{image.caption}</p>}

        {many && (
          <div className={styles.stepRow}>
            <button type="button" className={styles.step} disabled={index === 0}
              onClick={() => setIndex((i) => i - 1)} aria-label="Previous picture">
              ← PREV
            </button>
            <button type="button" className={styles.step} disabled={index === images.length - 1}
              onClick={() => setIndex((i) => i + 1)} aria-label="Next picture">
              NEXT →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
