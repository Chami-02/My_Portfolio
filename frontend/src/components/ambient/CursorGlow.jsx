// frontend/src/components/ambient/CursorGlow.jsx
import { useCallback, useEffect, useRef } from 'react';
import styles from './CursorGlow.module.css';

/**
 * Cursor-follow glow — PF-77.
 *
 * Transcribed from the glow-tracking half of bindPointer() (prototype
 * line 1075). The tilt effect bindPointer() also drives, targeting
 * [data-tilt] / [data-tilt-inner] at line 125, is the Hero portrait's
 * 3D tilt — not this component. That markup does not exist yet; it
 * belongs to whichever ticket builds the Hero section (PF-80). Grep
 * bindPointer() again there for the tilt half. The two only share one
 * listener in the prototype because its class component happened to be
 * structured that way, not because they are the same concern.
 *
 * The -260px margin on a 520px box (see the stylesheet) centres the
 * glow on its own top-left anchor, so this only ever moves that anchor
 * to the pointer coordinates — no centring offset recomputed per event.
 *
 * No pointerleave reset: confirmed absent from the prototype. Unlike
 * the star field's cursor tracking, which resets to (-9999,-9999) on
 * leave, the glow simply stays wherever it last was. Transcribed as-is.
 *
 * One deliberate departure: starts at opacity 0 and fades in on the
 * first pointermove, rather than being visible from mount with no
 * transform. The prototype's glow rests at an untransformed (0,0) — a
 * faint corner artifact, confirmed via Playwright in PF-75/PF-76. On a
 * touch-only device, which never fires pointermove at all, that is not
 * transient but permanent. Fading in on first movement fixes both with
 * one mechanism and no device detection.
 *
 * No splash-readiness gate and no reduced-motion gate on the tracking
 * itself — there is no loop here to defer, just a direct style write
 * per event, and the tracking is a 1:1 response to the user's own
 * cursor, not autoplaying motion. The fade-in is a plain CSS
 * transition, which PF-73's motion.css already collapses under
 * html[data-motion="reduced"] globally.
 *
 * Takes `ref` as an ordinary prop — see StarfieldCanvas.jsx for why
 * this repo does not use forwardRef.
 */
export default function CursorGlow({ ref: externalRef }) {
  const glowRef = useRef(null);

  const setRef = useCallback(
    (node) => {
      glowRef.current = node;
      if (typeof externalRef === 'function') externalRef(node);
      else if (externalRef) externalRef.current = node;
    },
    [externalRef],
  );

  useEffect(() => {
    const el = glowRef.current;
    if (!el) return undefined;

    let hasMoved = false;

    /** Prototype: the glow half of bindPointer()'s onMove. */
    const onMove = (e) => {
      el.style.transform = `translate3d(${e.clientX}px,${e.clientY}px,0)`;
      if (!hasMoved) {
        hasMoved = true;
        el.style.opacity = '1';
      }
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  return <div ref={setRef} aria-hidden="true" className={styles.glow} />;
}
