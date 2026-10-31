// PF-143 — dates stored as "2025", "2025-06" or "2025-06-04" (a year, a month
// and year, or — education only, owner 2026-10-31 — a full date):
// certificates' issue/expiry and education's start/end. Text, not Date, so a
// month never shifts across a time zone.

/** Three-letter months, like the rest of the site (locked: `SEP`). */
export const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const FULL_MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december'];
const MONTH_NUMBER = /^(0[1-9]|1[0-2])$/;

/** The earliest year the pickers offer; the latest is a few years ahead (an expected end). */
export const YEAR_MIN = 1980;
export const yearMax = (now = new Date()) => now.getFullYear() + 6;

/** "2025-06-04" → { year: '2025', month: '06', day: '04' }; missing parts are ''. */
export const splitMonthYear = (value) => {
  const [year = '', month = '', day = ''] = String(value || '').split('-');
  return { year, month, day };
};

/** A TYPED day → "01".."31"; '' when blank; null when it is not a day number. */
export const parseDay = (typed) => {
  const t = String(typed ?? '').trim();
  if (!t) return '';
  if (!/^\d{1,2}$/.test(t) || Number(t) < 1 || Number(t) > 31) return null;
  return t.padStart(2, '0');
};

/**
 * A TYPED month → "01".."12"; '' when blank; null when it is not a month.
 * Takes a number (6, 06) or a name of at least three letters (Jun, June, sept).
 */
export const parseMonth = (typed) => {
  const t = String(typed ?? '').trim().toLowerCase();
  if (!t) return '';
  if (/^\d{1,2}$/.test(t)) {
    const n = Number(t);
    return n >= 1 && n <= 12 ? String(n).padStart(2, '0') : null;
  }
  const i = t.length >= 3 ? FULL_MONTHS.findIndex((m) => m.startsWith(t)) : -1;
  return i >= 0 ? String(i + 1).padStart(2, '0') : null;
};

/**
 * The typed boxes → the stored value. Good parts become "2025", "2025-06" or
 * "2025-06-04"; a bad part is kept AS TYPED ("20", "2025-jux", "-06",
 * "2025--04"), so the form's check sees it and refuses the save — a typo never
 * silently vanishes.
 */
export const typedMonthYear = (year, month, day = '') => {
  const asTyped = (parsed, raw) => (parsed === null ? String(raw).trim() : parsed);
  const y = String(year ?? '').trim();
  const m = asTyped(parseMonth(month), month);
  const d = asTyped(parseDay(day), day);
  if (!y && !m && !d) return '';
  if (d) return `${y}-${m}-${d}`;
  return m ? `${y}-${m}` : y;
};

/** What is wrong with a stored/typed date, in the owner's words; null when fine (or blank). */
export const monthYearProblem = (value, now = new Date()) => {
  if (!value) return null;
  const { year, month } = splitMonthYear(value);
  if (!year) return 'Add the year too.';
  const max = yearMax(now);
  if (!/^\d{4}$/.test(year) || Number(year) < YEAR_MIN || Number(year) > max) {
    return `Type a year from ${YEAR_MIN} to ${max}.`;
  }
  const { day } = splitMonthYear(value);
  const parts = String(value).split('-').length;
  if (parts === 3 && !month) return 'Add the month too.';
  if (parts > 1 && !MONTH_NUMBER.test(month)) return 'Type a month: JAN–DEC or 1–12.';
  if (parts === 3) {
    if (!/^(0[1-9]|[12]\d|3[01])$/.test(day)) return 'Type a day: 1–31.';
    const last = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
    if (Number(day) > last) return `${MONTHS[Number(month) - 1]} ${year} has only ${last} days.`;
  }
  if (parts > 3) return 'Type a day: 1–31.';
  return null;
};

/** "2008-05-04" → "04 MAY 2008" (the blog's style); "2025-06" → "JUN 2025"; "2025" → "2025". */
export const formatMonthYear = (value) => {
  const { year, month, day } = splitMonthYear(value);
  if (!year) return '';
  if (!month) return year;
  return `${day ? `${day} ` : ''}${MONTHS[Number(month) - 1]} ${year}`;
};

/** True when the date is after `now`, at the date's own precision. */
export const isFuture = (value, now = new Date()) => {
  const { year, month, day } = splitMonthYear(value);
  if (!year) return false;
  const y = Number(year);
  if (y !== now.getFullYear()) return y > now.getFullYear();
  if (!month) return false;
  const m = Number(month);
  if (m !== now.getMonth() + 1) return m > now.getMonth() + 1;
  return day ? Number(day) > now.getDate() : false;
};

/** Compare two stored dates at the coarser precision: <0, 0 or >0. */
export const compareMonthYear = (a, b) => {
  const len = Math.min(a.length, b.length);
  return a.slice(0, len).localeCompare(b.slice(0, len));
};

/** "SEP 2022 – JUN 2026 (EXPECTED)", "2019 – 2021", "SEP 2022 – PRESENT". */
export const dateRange = (start, end, now = new Date()) => {
  if (!start) return formatMonthYear(end);
  const to = !end ? 'PRESENT' : `${formatMonthYear(end)}${isFuture(end, now) ? ' (EXPECTED)' : ''}`;
  return `${formatMonthYear(start)} – ${to}`;
};

/**
 * How many days a month has — the leap-year rule included (29 FEB only in a
 * leap year: every 4th year, except centuries not divisible by 400). Without
 * a month, 31; without a year, February offers 29.
 */
export const daysIn = (year, month) => {
  const m = Number(parseMonth(month));
  if (!m) return 31;
  const y = /^\d{4}$/.test(String(year).trim()) ? Number(year) : 2024;   // 2024: a leap year
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

/** Years for the suggestions: a few ahead (an expected end), back to 1980. */
export const yearChoices = (now = new Date()) => {
  const out = [];
  for (let y = yearMax(now); y >= YEAR_MIN; y -= 1) out.push(String(y));
  return out;
};
