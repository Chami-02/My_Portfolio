// frontend/src/components/ambient/GrainOverlay.jsx
import styles from './GrainOverlay.module.css';

/**
 * Grain texture slot — PF-75 scaffold, PF-77 fills in paintGrain(), a
 * memoised 140×140 noise canvas turned into a background data URL.
 *
 * Takes `ref` as an ordinary prop — see StarfieldCanvas.jsx for why this
 * repo does not use forwardRef.
 *
 * ⚠️ z-index 70. Sits ABOVE the header, below the splash (100) — the
 * grain renders over the navbar, not just over page content. Note the
 * Phase 1 navbar is currently z-index 50, not the prototype's 60; grain
 * clears either, but PF-79 has to raise it as part of the rebuild.
 *
 * ⚠️ Opacity has THREE states, not two. The static markup default is
 * 0.5 (before any JS runs) — that is what this stylesheet carries.
 * paintGrain() sets it to 0.42 once the texture is generated, but that
 * is not the resting value either: applyTheme() overrides it again, on
 * every toggle, to .13 (light) or .45 (dark). So grain is theme-reactive
 * the same way the star canvas is (PF-76's pal()) — PF-77 has to re-read
 * the theme on toggle, not just paint once and stop. 0.42 is a transient
 * value between paint and the first theme application, not steady state.
 */
export default function GrainOverlay({ ref }) {
  return <div ref={ref} aria-hidden="true" className={styles.grain} />;
}
