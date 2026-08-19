// frontend/src/components/ambient/GrainOverlay.jsx
import { useCallback, useEffect, useRef } from 'react';
import { useTheme } from '../../hooks/useTheme';
import styles from './GrainOverlay.module.css';

/**
 * Grain texture overlay — PF-77.
 *
 * Transcribed from paintGrain() (prototype line 714) plus the grain
 * branch of applyTheme() (line 859), with one preserved quirk worth
 * naming rather than "fixing": on mount, the theme-sync effect below
 * runs first and sets the theme-correct opacity (.13 light / .45 dark)
 * — then the paint-once effect runs second and immediately overwrites
 * it to 0.42. That is the prototype's real behaviour, confirmed against
 * source: componentDidMount() calls applyTheme(t0) at line 881 and
 * paintGrain() at line 884, in that order. So 0.42 is genuinely the
 * resting opacity from first load until the user's first theme toggle,
 * not a value that flashes briefly before something else takes over.
 * This corrects PF-75's own comment here, which called 0.42 transient.
 * Effect declaration order below reproduces it exactly — React runs
 * effects in declaration order, so do not reorder them.
 *
 * ⚠️ z-index 70. Sits ABOVE the header — the grain renders over the
 * navbar, not just over page content. Phase 1's navbar is z-index 50,
 * the prototype's is 60; grain clears either, but PF-79 has to keep it
 * that way as part of the navbar rebuild.
 *
 * No splash or reduced-motion gate — this paints once and stops, so
 * there is no per-frame cost to defer the way StarfieldCanvas's
 * continuous loop had. See the ticket's Step 1.
 *
 * Takes `ref` as an ordinary prop — see StarfieldCanvas.jsx for why
 * this repo does not use forwardRef.
 */
export default function GrainOverlay({ ref: externalRef }) {
  const grainRef = useRef(null);
  const { isLight } = useTheme();

  // Merges PF-75's external ref contract with the internal ref these
  // effects need direct access to.
  const setRef = useCallback(
    (node) => {
      grainRef.current = node;
      if (typeof externalRef === 'function') externalRef(node);
      else if (externalRef) externalRef.current = node;
    },
    [externalRef],
  );

  /** Prototype: the grain branch of applyTheme(). Declared first so it
   *  runs first on mount — see the header comment. */
  useEffect(() => {
    const el = grainRef.current;
    if (!el) return;
    el.style.opacity = isLight ? '.13' : '.45';
  }, [isLight]);

  /** Prototype: paintGrain(). Runs once — the texture is theme-neutral
   *  greyscale noise, so a toggle only needs the opacity above. */
  useEffect(() => {
    const el = grainRef.current;
    if (!el) return;

    const n = 140;
    // Never appended to the DOM. It exists only to produce a PNG data
    // URL, which becomes a background-image on the real <div> — which
    // is why PF-75's choice of <div> over <canvas> for this slot was
    // correct.
    const c = document.createElement('canvas');
    c.width = n;
    c.height = n;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    const id = ctx.createImageData(n, n);
    for (let i = 0; i < id.data.length; i += 4) {
      const v = 120 + Math.random() * 135;
      id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
      id.data[i + 3] = 15 + Math.random() * 16;
    }
    ctx.putImageData(id, 0, 0);

    el.style.backgroundImage = `url(${c.toDataURL('image/png')})`;
    el.style.backgroundRepeat = 'repeat';
    el.style.opacity = '0.42';
  }, []);

  return <div ref={setRef} aria-hidden="true" className={styles.grain} />;
}
