// frontend/src/utils/audienceStats.js
//
// PF-149 — the Analytics panel's plain calculations, free of React so each can
// be proved against known numbers (owner: "100% accurate").
//
// ⚠️ NOT named analytics.js: ad blockers refuse that file name and the panel
// would not load (measured in the owner's Chrome, silent-failures.md).
//
// ⚠️ Days are Sri Lanka dates sent as text ('2026-11-06', the counter's `day`).
// Everything here works on them in UTC, purely as calendar arithmetic. A local
// `new Date(y, m, d)` would move a day for a reader in another time zone.

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const asDate = (day) => new Date(`${day}T00:00:00Z`);
const asDay  = (date) => date.toISOString().slice(0, 10);

/** The Monday of a day's week. */
export function weekStart(day) {
  const date = asDate(day);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return asDay(date);
}

/** "6 NOV" */
export function dayLabel(day) {
  const date = asDate(day);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

/** "6 NOV 2026" */
export function fullDayLabel(day) {
  return `${dayLabel(day)} ${day.slice(0, 4)}`;
}

const BUCKETS = {
  day:   { keyOf: (d) => d,              labelOf: dayLabel,                             startOf: (k) => k },
  week:  { keyOf: weekStart,             labelOf: (k) => `WK ${dayLabel(k)}`,           startOf: (k) => k },
  month: { keyOf: (d) => d.slice(0, 7),  labelOf: (k) => `${MONTHS[Number(k.slice(5)) - 1]} ${k.slice(0, 4)}`, startOf: (k) => `${k}-01` },
  year:  { keyOf: (d) => d.slice(0, 4),  labelOf: (k) => k,                             startOf: (k) => `${k}-01-01` },
};

/** How many of the newest buckets each view draws. The sums never change. */
export const GROWTH_WINDOW = { day: 30, week: 26, month: 24, year: Infinity };

/**
 * Daily rows → day, week, month or year rows, oldest first.
 *
 * `partial`: the newest one is still running, so it is marked "so far" and never
 * read as a fall. `startsLate`: counting began part-way through the oldest one,
 * so it is too small to be a fair comparison.
 *
 * ⚠️ Visitors are summed from daily counts, because that is all the counter
 * holds: someone who came on three days is 3 in a week. The panel says so.
 */
export function groupGrowth(days, unit) {
  const { keyOf, labelOf, startOf } = BUCKETS[unit];
  const buckets = new Map();
  days.forEach(({ day, visitors, views }) => {
    const key = keyOf(day);
    const bucket = buckets.get(key) ?? { key, label: labelOf(key), visitors: 0, views: 0 };
    bucket.visitors += visitors;
    bucket.views    += views;
    buckets.set(key, bucket);
  });
  const rows = [...buckets.values()];
  return rows.map((row, i) => ({
    ...row,
    partial:    i === rows.length - 1,
    startsLate: i === 0 && startOf(row.key) < days[0].day,
  }));
}

/**
 * The comparison beside a number.
 *   { kind: 'none' }                nothing to say
 *   { kind: 'new' }                 no fair earlier number, never an invented %
 *   { kind: 'same' }
 *   { kind: 'up' | 'down', percent }
 */
export function changeFrom(current, previous, comparable = true) {
  if (!comparable || previous === 0) return { kind: current > 0 ? 'new' : 'none' };
  if (current === previous) return { kind: 'same' };
  return {
    kind:    current > previous ? 'up' : 'down',
    percent: Math.round((Math.abs(current - previous) / previous) * 100),
  };
}

/**
 * The newest FINISHED bucket against the one before it. Null until two fair
 * ones exist: the running bucket would always look like a crash, and the first
 * one may hold only part of its period.
 */
export function growthChange(buckets) {
  const finished = buckets.filter((b) => !b.partial);
  if (finished.length < 2) return null;
  const last  = finished[finished.length - 1];
  const prior = finished[finished.length - 2];
  if (prior.startsLate) return null;
  return {
    label:    last.label,
    against:  prior.label,
    visitors: changeFrom(last.visitors, prior.visitors),
    views:    changeFrom(last.views, prior.views),
  };
}

/** Biggest first; ties by name, so the order never shuffles between refreshes. */
export function sortRows(rows) {
  return [...rows].sort((x, y) => y.count - x.count || x.key.localeCompare(y.key));
}

/** The top `limit`, then everything else as one "Other" row. The sum is unchanged. */
export function topWithOther(rows, limit) {
  const sorted = sortRows(rows);
  if (sorted.length <= limit) return sorted;
  const rest = sorted.slice(limit).reduce((sum, row) => sum + row.count, 0);
  return [...sorted.slice(0, limit), { key: OTHER_KEY, count: rest }];
}

export const OTHER_KEY = '(other)';

export const totalOf = (rows) => rows.reduce((sum, row) => sum + row.count, 0);

/**
 * Whole percentages that always add up to 100 (largest remainder), because a
 * colour key reading 33 + 33 + 33 under a whole circle looks like an error.
 */
export function withShares(rows) {
  const total = totalOf(rows);
  if (total === 0) return rows.map((row) => ({ ...row, percent: 0 }));
  const exact = rows.map((row) => (row.count / total) * 100);
  const whole = exact.map(Math.floor);
  const order = exact
    .map((value, i) => ({ i, remainder: value - whole[i] }))
    .sort((x, y) => y.remainder - x.remainder || x.i - y.i);
  let missing = 100 - whole.reduce((sum, value) => sum + value, 0);
  for (const { i } of order) {
    if (missing === 0) break;
    whole[i] += 1;
    missing -= 1;
  }
  return rows.map((row, i) => ({ ...row, percent: whole[i] }));
}

/** All 24 hours, oldest first, with the quiet ones as 0. */
export function fullDayOfHours(rows) {
  const counts = new Map(rows.map((row) => [row.key, row.count]));
  return Array.from({ length: 24 }, (_, hour) => {
    const key = String(hour).padStart(2, '0');
    return { key, count: counts.get(key) ?? 0 };
  });
}

// ── The shapes drawn from the numbers ───────────────────────────────────────

/** Line and area points on a `width` × `height` drawing; y grows downward. */
export function chartPoints(values, top, width, height) {
  return values.map((value, i) => ({
    x: values.length === 1 ? width / 2 : (i / (values.length - 1)) * width,
    y: height - (value / top) * height,
  }));
}

/** How much of the full height or width a value takes, as a percentage. */
export const shareOfTop = (value, top) => (value / top) * 100;

/** A bar's length. A tiny real count keeps a visible sliver; zero draws nothing. */
export const barPercent = (value, top) =>
  (value > 0 ? Math.max(shareOfTop(value, top), 1.5) : 0);

/** Where each slice starts and how big it is, out of 100, in order. */
export function pieSlices(rows) {
  const total = totalOf(rows);
  let start = 0;
  return rows.map((row, i) => {
    const size = (row.count / total) * 100;
    const slice = { row, i, start, size };
    start += size;
    return slice;
  });
}

/** A round top for a chart's axis, close enough to use the height. Never 0. */
export function niceMax(value) {
  if (value <= 1) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step  = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((m) => m * power >= value);
  return step * power;
}

// ── Words for what the counter stored ───────────────────────────────────────

const NAMED_KEYS = {
  '(unknown)': 'Unknown',
  '(other)':   'Other',
  '(direct)':  'Typed the address or a saved link',
};

const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });

/** 'LK' → 'Sri Lanka'. */
export function countryLabel(key) {
  if (NAMED_KEYS[key]) return NAMED_KEYS[key];
  if (!/^[A-Z]{2}$/.test(key)) return key;
  try {
    return countryNames.of(key) ?? key;
  } catch {
    return key;
  }
}

export const plainLabel = (key) => NAMED_KEYS[key] ?? key;

/** A device key ('phone') as a title. */
export const titleLabel = (key) =>
  NAMED_KEYS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);

/** The counter stores 'Galle, LK', so a city keeps its own country. */
const LOCAL_SUFFIX = ', LK';

export const localCities = (rows) => rows
  .filter((row) => row.key.endsWith(LOCAL_SUFFIX))
  .map((row) => ({ ...row, key: row.key.slice(0, -LOCAL_SUFFIX.length) }));

/** '09' → '9 AM', the owner's clock. */
export function hourLabel(key) {
  const hour = Number(key);
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve} ${hour < 12 ? 'AM' : 'PM'}`;
}

export const countText = (value) => value.toLocaleString('en-US');

/** A chart's colour by its place in the validated order (tokens.css). */
export const chartColour = (slot) => `var(--chart-${slot})`;

/** "12 seconds ago" / "2 minutes ago" for the live line. */
export function agoText(ms) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'} ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'} ago`;
}
