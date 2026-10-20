// frontend/src/utils/messageTime.js
//
// PF-123 — when a contact message arrived, the way the owner reads it:
// `{ date: '2026/10/20', time: '11:43 PM' }` (YYYY/MM/DD, 12-hour clock —
// owner, 2026-10-20) in the owner's zone (the About panel's `timezone`).
//
// ⚠️ Mirrored by `backend/src/controllers/contactController.js` `formatSent`,
// which formats the same instant for the owner's email — two packages that
// cannot import from each other. Change both together, or the panel and the
// email disagree about when a message came in.

/** The About model's default, for a blank `timezone` (blank = "hide it on the site"). */
export const DEFAULT_ZONE = 'Asia/Colombo';

export function formatSent(when, timeZone) {
  const part = {};
  new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: 'numeric', minute: '2-digit', hourCycle: 'h12',
  }).formatToParts(new Date(when)).forEach(({ type, value }) => { part[type] = value; });
  return {
    date: `${part.year}/${part.month}/${part.day}`,
    time: `${part.hour}:${part.minute} ${part.dayPeriod.toUpperCase()}`,
  };
}
