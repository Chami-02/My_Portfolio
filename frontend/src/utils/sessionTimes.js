// frontend/src/utils/sessionTimes.js
//
// PF-132 — the Sessions card's "ACTIVE 12 MIN AGO". React-free so each step
// is unit-testable with a fixed `now`.
//
// ⚠️ A device's "last active" is its last token REFRESH, which happens once
// per 15-minute access token while it is in use — so anything under 15
// minutes reads as "in the last 15 min" rather than claiming a precision the
// server does not have.

const MIN  = 60 * 1000;
const HOUR = 60 * MIN;
const DAY  = 24 * HOUR;

export const REFRESH_EVERY_MS = 15 * MIN;

/** "ACTIVE IN THE LAST 15 MIN" · "ACTIVE 40 MIN AGO" · "… 3 H AGO" · "… 2 DAYS AGO". */
export function activeText(iso, now = Date.now()) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const ago = now - then;
  // A clock a little ahead of the server makes `ago` negative — still under
  // one interval, so it lands here too.
  if (ago < REFRESH_EVERY_MS) return 'ACTIVE IN THE LAST 15 MIN';
  if (ago < HOUR) return `ACTIVE ${Math.floor(ago / MIN)} MIN AGO`;
  if (ago < DAY)  return `ACTIVE ${Math.floor(ago / HOUR)} H AGO`;
  const days = Math.floor(ago / DAY);
  return `ACTIVE ${days} ${days === 1 ? 'DAY' : 'DAYS'} AGO`;
}
