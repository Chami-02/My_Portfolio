import { useEffect, useRef } from 'react';

/**
 * PF-153's big-view behaviour (MessageView), shared since PF-154 with the SENT
 * view so the two can never drift:
 *
 *   • Esc closes, ← → step, Tab stays inside the dialog. The listener is added
 *     once and reads the latest values through a ref, refreshed every render.
 *   • A dialog on top (the delete confirm, the unsaved-reply question) answers
 *     its own keys. In a textarea the arrows move the cursor, not the item.
 *   • Open: the page behind stops scrolling and focus moves to the close button;
 *     closed: both undone, focus back where it was.
 *
 * @returns {{ panelRef, closeRef }}  for the dialog's panel and its close button
 */
export function useViewDialog({ onClose, onGo, prev, next }) {
  const panelRef = useRef(null);
  const closeRef = useRef(null);

  const keys = useRef(null);
  useEffect(() => { keys.current = { onClose, onGo, prev, next }; });
  useEffect(() => {
    const onKey = (e) => {
      const k = keys.current;
      if (!k || document.querySelectorAll('[role="dialog"]').length > 1) return;
      const typing = e.target instanceof HTMLTextAreaElement;
      if (e.key === 'Escape') { e.preventDefault(); k.onClose(); }
      else if (e.key === 'ArrowLeft' && k.prev && !typing) { e.preventDefault(); k.onGo(k.prev); }
      else if (e.key === 'ArrowRight' && k.next && !typing) { e.preventDefault(); k.onGo(k.next); }
      else if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll('a[href], button:not([disabled])');
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

  useEffect(() => {
    const opener = document.activeElement;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      root.style.overflow = before;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  return { panelRef, closeRef };
}
