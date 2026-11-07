// frontend/src/components/layout/VisitTracker.jsx
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  countVisit, linkKind, markEngaged, outsideReferrer, shouldCount, startEngagementClock,
} from '../../utils/visits';

/* After the browser has finished its own work, so a count can never slow the
   page. Safari has no requestIdleCallback; the timeout there just means "after
   this paint". */
const whenIdle = (fn) => {
  if (window.requestIdleCallback) window.requestIdleCallback(fn, { timeout: 2000 });
  else setTimeout(fn, 200);
};

/**
 * PF-145 — one count per page opened, and one per click on a counted link.
 * Renders nothing. What is left out is decided in utils/visits.js, and nothing
 * goes out until the visit is engaged (the owner's rule, also there).
 */
export function VisitTracker() {
  const { pathname, state } = useLocation();
  const lastPath = useRef(null);
  const sentReferrer = useRef(false);

  useEffect(() => {
    // StrictMode runs an effect twice on mount; one page opened is one count.
    if (lastPath.current === pathname) return;
    const isSecondPage = lastPath.current !== null;
    // PF-153: forwarded from an old link. One page, counted when it opened. Only
    // in this page load: the mark stays in history, and a reload is a new opening.
    const forwarded = isSecondPage && state?.forwarded;
    lastPath.current = pathname;
    if (forwarded) return;
    if (!shouldCount(pathname)) return;

    // document.referrer never changes in a single-page app, so after the first
    // view it would credit every later page to the same outside site.
    const referrer = sentReferrer.current ? undefined : outsideReferrer();
    sentReferrer.current = true;

    whenIdle(() => {
      countVisit({ type: 'view', path: pathname, referrer });
      if (isSecondPage) markEngaged();
    });
  }, [pathname, state]);

  useEffect(() => startEngagementClock(), []);

  // One listener for the whole document, so no link has to know it is counted.
  // `capture`: a link's own handler stopping the event must not hide the click.
  useEffect(() => {
    const onClick = (event) => {
      const anchor = event.target.closest?.('a[href]');
      if (!anchor || !shouldCount(window.location.pathname)) return;
      const link = linkKind(anchor);
      if (!link) return;
      markEngaged();
      countVisit({ type: 'click', link });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return null;
}

export default VisitTracker;
