// frontend/src/components/ambient/StarfieldCanvas.jsx
import styles from './StarfieldCanvas.module.css';

/**
 * Star field canvas slot — PF-75 scaffold, PF-76 fills in the draw loop.
 *
 * Takes `ref` as an ordinary prop rather than going through forwardRef.
 * React 19 passes ref straight to function components, and forwardRef is
 * deprecated — these are the first ref-forwarding components in the repo,
 * so there is no existing pattern to stay consistent with.
 *
 * Accepts the ref rather than owning one internally: PF-76 needs direct
 * canvas access for getContext(), and creating the ref here would just
 * add a layer of indirection PF-76 has to reach through for no benefit.
 */
export default function StarfieldCanvas({ ref }) {
  return <canvas ref={ref} aria-hidden="true" className={styles.canvas} />;
}
