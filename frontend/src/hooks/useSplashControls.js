// frontend/src/hooks/useSplashControls.js
import { useContext } from 'react';
import { SplashContext } from '../providers/SplashContext';

/**
 * Imperative control over splash-readiness — for the splash component
 * itself (PF-78), not for Reveal/CountUp or anything else that just
 * needs to read the state. Those use useSplashReady().
 *
 * Split from useSplashReady() deliberately, not just for symmetry with
 * how ThemeContext/MotionContext were separated into their own files.
 * useTheme() bundles read+toggle in one hook because toggling theme is
 * meant to be callable from anywhere (a ThemeToggle button, anywhere in
 * the tree). setReady is different: exactly one component should ever
 * call it. Putting setReady on the same widely-used hook that Reveal
 * and CountUp both call would hand every consumer of splash STATE the
 * ability to also control it — a footgun this split avoids.
 *
 * Unlike useSplashReady(), this assumes a real SplashProvider exists.
 * The splash only ever renders inside the tree SplashProvider wraps, so
 * setReady is never undefined in practice — but if you're reaching for
 * this hook anywhere other than the splash component itself, you
 * probably want useSplashReady() instead.
 */
export function useSplashControls() {
  return useContext(SplashContext);
}
