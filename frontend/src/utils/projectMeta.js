// PF-144 — what a project card and a project page print under the title.
// React-free, unit-testable (utils/ rule).

import { formatMonthYear } from './monthYear';

/**
 * The date line: "FEB 2024 – PRESENT". Both ends always carry their year (never
 * "JAN – MAY 2025"), in the site's three-letter-month style
 * ("JAN 2025 – MAY 2025"). One date alone prints alone; the same start and
 * end print once. '' when the project has no dates at all.
 */
export const projectPeriod = ({ startedOn, endedOn, ongoing } = {}) => {
  const start = formatMonthYear(startedOn);
  const end = ongoing ? 'PRESENT' : formatMonthYear(endedOn);
  if (start && end && start !== end) return `${start} – ${end}`;
  if (ongoing && !start) return 'ONGOING';
  return start || end;
};

/** "Team lead · ClearDrive.lk" — the blanks left out; '' when both are. */
export const projectByline = ({ role, client } = {}) =>
  [role, client].map((v) => String(v ?? '').trim()).filter(Boolean).join(' · ');

/** The one category a project carries (the label on its picture), or ''. */
export const projectCategory = ({ categories } = {}) =>
  (Array.isArray(categories) && categories[0]) || '';

/**
 * The picture at a size fit for where it shows. A Cloudinary upload is
 * asked for at most `width` px, in the best format the browser takes
 * (`f_auto`, `q_auto`) — a card never downloads the 2400px original. Any
 * other address is returned as it is.
 */
export const pictureAt = (src, width) => {
  const marker = '/image/upload/';
  if (typeof src !== 'string' || !src.includes('res.cloudinary.com') || !src.includes(marker)) return src;
  return src.replace(marker, `${marker}c_limit,w_${width},f_auto,q_auto/`);
};
