// frontend/src/utils/timezone.js
//
// PF-118 batch 2 — the About document stores an IANA PLACE ("Asia/Colombo");
// the site prints its OFFSET ("UTC+5:30"), worked out for the moment of
// rendering. That is what makes daylight saving correct: Europe/London prints
// UTC+0 in January and UTC+1 in July, which no stored offset can do.
//
// React-free, so every consumer (Contact, Footer, the panel's dropdown) formats
// through ONE function rather than three that drift.

// ⚠️ Mirrors `backend/src/utils/timeZone.js` — the SHAPE check is what stops an
// offset string ("+05:30"), which ICU itself accepts, from passing as a place.
const SHAPE = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)*$/;

/** Is this a time-zone name the browser's ICU recognises? */
export function isTimeZone(value) {
  if (typeof value !== 'string' || !SHAPE.test(value)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * `Asia/Colombo` → `UTC+5:30`, for `date` (default: now).
 *
 * - blank → `''` (the owner hid it; callers drop the separator too)
 * - not a place (a legacy free-text value) → returned UNCHANGED, so an old
 *   document renders what it always rendered instead of nothing
 *
 * ICU writes `GMT+5:30` / `GMT-3` / plain `GMT`; the site has always said UTC,
 * and plain GMT is +0.
 */
export function timezoneLabel(zone, date = new Date()) {
  if (!zone) return '';
  if (!isTimeZone(zone)) return zone;
  const name = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' })
    .formatToParts(date)
    .find((p) => p.type === 'timeZoneName')?.value ?? '';
  const offset = name.replace(/^GMT/, '');
  return `UTC${offset || '+0'}`;
}

/**
 * The dropdown's contents: every place ICU lists, grouped by its region
 * (`Africa`, `America`, `Asia`…), each labelled with today's offset.
 *
 * `Intl.supportedValuesOf` is in every browser this site supports (Chrome 99,
 * Safari 15.4, Firefox 93). The empty fallback keeps an ancient browser from
 * crashing the panel — it would show only "None" and the stored value.
 */
export function timezoneGroups(date = new Date()) {
  const zones = typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : [];
  const groups = new Map();
  for (const zone of zones) {
    const region = zone.includes('/') ? zone.slice(0, zone.indexOf('/')) : 'Other';
    if (!groups.has(region)) groups.set(region, []);
    groups.get(region).push({ value: zone, label: `${zone.replace(/_/g, ' ')} — ${timezoneLabel(zone, date)}` });
  }
  return [...groups].map(([region, options]) => ({ region, options }));
}
