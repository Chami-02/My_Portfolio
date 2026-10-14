import { useState, useEffect, useSyncExternalStore } from 'react';
import { session }     from '../../services/session';
import { authService } from '../../services/authService';
import a from '../../styles/admin.module.css';

/**
 * PF-108 — "your session is about to end", with a way to stop it.
 *
 * Shows for the last WARN_MS of the refresh token's life, with a STAY
 * SIGNED IN button that rotates the token — which pushes the expiry a full
 * lifetime forward and, because the store notifies, dismisses the banner.
 * Nothing on the page is touched, so a half-edited form survives.
 *
 * ⚠️ This is the IDLE case only. api.js refreshes silently on any 401, so a
 * panel that is being used never gets within WARN_MS of expiry — the token
 * has been rotated long before. What this catches is a tab left open over a
 * weekend, where no request has fired since the last rotation. Verify it
 * with a short `REFRESH_TOKEN_TTL_DAYS`, not by waiting.
 *
 * Two clocks: `expiresAt` comes from the store (useSyncExternalStore, so a
 * rotation anywhere re-renders this), and `now` is a state value advanced by
 * a timer set for the exact moment the answer changes — the warn threshold,
 * then the expiry — rather than a polling interval. setState lives in the
 * timer callback, never the effect body.
 */
const WARN_MS = 5 * 60 * 1000;

const subscribe = (fn) => session.subscribe(fn);
const getExpiresAt = () => session.getRefreshExpiresAt();

// Whole minutes, rounded up, so "1 MIN" never reads as zero while there
// is still time to click.
const minutesLeft = (ms) => Math.max(1, Math.ceil(ms / 60000));

export function SessionExpiryBanner({ className = '' }) {
  const expiresAt = useSyncExternalStore(subscribe, getExpiresAt);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (expiresAt === null) return undefined;
    const warnAt = expiresAt - WARN_MS;
    // Wake at whichever boundary is next: the warning, then the expiry.
    const nextTick = Date.now() < warnAt ? warnAt : expiresAt;
    const delay = Math.max(0, nextTick - Date.now());
    if (Date.now() >= expiresAt) return undefined;   // nothing left to wait for
    const id = setTimeout(() => setNow(Date.now()), delay + 50);
    return () => clearTimeout(id);
  }, [expiresAt, now]);

  if (expiresAt === null) return null;
  const remaining = expiresAt - now;
  if (remaining > WARN_MS || remaining <= 0) return null;

  const stay = async () => {
    setBusy(true);
    try {
      await authService.refresh();   // the store notifies → expiresAt moves → banner goes
    } catch {
      // A dead session: api.js has already cleared the store and told the
      // cache, so ProtectedRoute is about to navigate. Nothing to show here.
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`${a.bannerError} ${className}`.trim()} role="status">
      <span aria-hidden="true" className={a.bannerDot} />
      YOUR SESSION ENDS IN {minutesLeft(remaining)} MIN — UNSAVED CHANGES WILL BE LOST
      <button
        type="button"
        onClick={stay}
        disabled={busy}
        className={a.bannerAction}
      >
        {busy ? 'RENEWING…' : 'STAY SIGNED IN'}
      </button>
    </div>
  );
}
