// frontend/src/utils/seasonalEffect.js

/**
 * PF-151 — which seasonal effect shows, and the sentence that says so. The site
 * and the Settings card both read this file, so they cannot disagree.
 *
 * Owner, 2026-11-06: snow 1 December → 1 January, Halloween 31 October →
 * 2 November, both days included, every year with nobody touching anything.
 *
 * The date is the VISITOR's own calendar, like every date on the site (locked,
 * 2026-10-14) — `getMonth`/`getDate`, never the UTC forms.
 */

/** ⚠️ Mirrored by `seasonalEffect` in `backend/src/models/About.js`. */
export const SEASONAL_MODES = Object.freeze(['auto', 'snow', 'halloween', 'off']);

const OCTOBER = 9;
const NOVEMBER = 10;
const DECEMBER = 11;
const JANUARY = 0;

const isSnowSeason = (now) =>
  now.getMonth() === DECEMBER || (now.getMonth() === JANUARY && now.getDate() === 1);

const isHalloweenSeason = (now) =>
  (now.getMonth() === OCTOBER && now.getDate() === 31)
  || (now.getMonth() === NOVEMBER && now.getDate() <= 2);

/**
 * `'snow' | 'halloween' | null`. A missing or unknown mode counts as `auto`, so
 * a backend from before this field (or a failed load) still follows the dates.
 */
export function activeEffect(mode, now = new Date()) {
  if (mode === 'snow' || mode === 'halloween') return mode;
  if (mode === 'off') return null;
  if (isSnowSeason(now)) return 'snow';
  if (isHalloweenSeason(now)) return 'halloween';
  return null;
}

/** What visitors see right now, in the owner's plain words. */
export function seasonStatus(mode, now = new Date()) {
  if (mode === 'snow') return 'Snow is showing to every visitor, whatever the date.';
  if (mode === 'halloween') return 'Leaves and bats are showing to every visitor, whatever the date.';
  if (mode === 'off') return 'Off. Nothing is showing, even during the seasons.';

  const effect = activeEffect('auto', now);
  if (effect === 'snow') return 'Automatic. Snow is showing until 1 January.';
  if (effect === 'halloween') return 'Automatic. Leaves and bats are showing until 2 November.';
  // Only 3–30 November is closer to snow; from 2 January on, Halloween is next.
  return now.getMonth() === NOVEMBER
    ? 'Automatic. Nothing is showing today. Snow starts on 1 December.'
    : 'Automatic. Nothing is showing today. Leaves and bats start on 31 October.';
}
