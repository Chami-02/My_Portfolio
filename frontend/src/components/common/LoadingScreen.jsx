import { useEffect, useState } from 'react';
import { StarfieldCanvas, CursorGlow, GrainOverlay } from '../ambient';
import { BrandMark } from './BrandMark';
import styles from './LoadingScreen.module.css';

/**
 * How long a wait has to last before it is worth a loading screen.
 *
 * PF-130, owner's rule (2026-10-20): show it only when loading is slower
 * than usual, never add time to a load, and never hold the screen once the
 * content is ready. So this is a DELAY and there is no minimum display
 * time — a fast load looks exactly as it did before, a slow one gets the
 * mark from 300 ms until the moment it finishes.
 */
export const LOADING_DELAY_MS = 300;

/*
 * How many loading screens are on screen right now (0 or 1 in practice).
 *
 * ⚠️ The hand-off this exists for: ProtectedRoute shows a screen while
 * /auth/me answers, then renders <AdminPage/>, whose lazy chunk suspends
 * to ANOTHER screen. They are different instances, so each would start its
 * own 300 ms — a slow sign-in would show the mark, blank for 300 ms, and
 * show it again. React renders the new instance BEFORE it unmounts the old
 * one, so the new one can read this count in its initial state and start
 * visible.
 */
let visibleCount = 0;

/**
 * The branded "this is slow" screen: logo, pulsing ring, a label.
 *
 *   full-screen (default)  App's Suspense fallback and ProtectedRoute's
 *                          session check. Holds the viewport so the footer
 *                          does not jump, and mounts the site's ambient
 *                          layer — but only once shown, so a fast load
 *                          never flashes a starfield the next page re-seeds.
 *   inline                 inside a page that has its own background (the
 *                          blog reading view's placeholder).
 *
 * The status region renders at once and EMPTY; the label arrives after the
 * delay. A live region announces content that changes inside it, so it has
 * to exist before its text does.
 *
 * The delay is a timer, not a CSS animation-delay: motion.css forces
 * `animation-delay: 0ms` under reduced motion, which would show the screen
 * on every fast load for exactly the visitors who asked for less movement.
 */
export function LoadingScreen({ label, inline = false }) {
  // Read once: a screen that takes over from a visible one starts visible.
  const [handedOff] = useState(() => visibleCount > 0);
  const [shown, setShown] = useState(handedOff);

  useEffect(() => {
    let counted = false;
    const count = () => { counted = true; visibleCount += 1; };
    let timer;
    if (handedOff) count();
    else timer = setTimeout(() => { count(); setShown(true); }, LOADING_DELAY_MS);
    return () => {
      clearTimeout(timer);
      if (counted) visibleCount -= 1;
    };
  }, [handedOff]);

  return (
    <div role="status" className={inline ? styles.inline : styles.screen}>
      {shown && (
        <>
          {!inline && (
            <>
              <StarfieldCanvas />
              <CursorGlow />
              <GrainOverlay />
            </>
          )}
          <span className={styles.content}>
            <BrandMark alt="" />
            <span className={styles.label}>{label}</span>
          </span>
        </>
      )}
    </div>
  );
}
