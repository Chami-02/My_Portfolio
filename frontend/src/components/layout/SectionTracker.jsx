// frontend/src/components/layout/SectionTracker.jsx
import { useEffect, useRef } from 'react';
import { useSplashReady } from '../../hooks/useSplashReady';
import { HOME_SECTIONS, countVisit, hasReached, shouldCount } from '../../utils/visits';

// One step per percent: a tall section reaches half a screen at a small share
// of its own height, so coarse steps would never fire at the right moment.
const THRESHOLDS = Array.from({ length: 101 }, (_, i) => i / 100);

/**
 * PF-149 — "most reached sections": one count per section per page opened, once
 * enough of it has been on screen. Renders nothing.
 *
 * Reached sections wait and go as ONE request when the visitor leaves or switches
 * away. One request each would cost up to 6 per page opened, and the free plan
 * counts them. `visibilitychange` is the reliable signal on a phone; `pagehide`
 * and leaving this page cover the rest.
 *
 * Mounted inside HomePage, not beside VisitTracker: it needs the sections in the
 * page and the splash's state. It waits for the splash because that overlay
 * covers the hero, and the observer cannot see an overlay (useSplashReady).
 */
export function SectionTracker() {
  const ready = useSplashReady();
  // A ref, so StrictMode's second effect run cannot count a section twice. A
  // return to the home page mounts a new tracker: that is a new page opened.
  const counted = useRef(new Set());
  const waiting = useRef([]);

  useEffect(() => {
    if (!ready || !window.IntersectionObserver || !shouldCount('/')) return undefined;

    const send = () => {
      if (waiting.current.length === 0) return;
      countVisit({ type: 'section', sections: waiting.current });
      waiting.current = [];
    };
    const onHide = () => { if (document.visibilityState === 'hidden') send(); };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(({ target, intersectionRect, boundingClientRect, rootBounds }) => {
        const viewport = rootBounds?.height ?? window.innerHeight;
        if (counted.current.has(target.id)
          || !hasReached(intersectionRect.height, boundingClientRect.height, viewport)) return;
        counted.current.add(target.id);
        observer.unobserve(target);
        waiting.current.push(target.id);
      });
    }, { threshold: THRESHOLDS });

    HOME_SECTIONS.forEach((id) => {
      const section = document.getElementById(id);
      if (section && !counted.current.has(id)) observer.observe(section);
    });
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', send);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', send);
      send();
    };
  }, [ready]);

  return null;
}

export default SectionTracker;
