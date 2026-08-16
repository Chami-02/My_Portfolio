// frontend/src/components/ambient/CursorGlow.jsx
import styles from './CursorGlow.module.css';

/**
 * Cursor-follow glow slot — PF-75 scaffold, PF-77 fills in pointer
 * tracking (translate this element's own anchor point to the cursor).
 *
 * Takes `ref` as an ordinary prop — see StarfieldCanvas.jsx for why this
 * repo does not use forwardRef.
 *
 * The -260px margin on a 520px box centers the glow on its own top-left
 * anchor, so PF-77 only ever has to move that anchor to the pointer
 * coordinates — not recompute a centering offset every frame.
 *
 * ⚠️ Until PF-77 sets a transform, this sits at its (0,0) anchor, so a
 * quarter of the circle is visible in the top-left corner. The prototype
 * does exactly the same thing — bindPointer() sets no initial transform,
 * so the glow rests in that corner until the first pointermove. On a
 * touch-only device, which never fires pointermove at all, it stays
 * there permanently.
 */
export default function CursorGlow({ ref }) {
  return <div ref={ref} aria-hidden="true" className={styles.glow} />;
}
