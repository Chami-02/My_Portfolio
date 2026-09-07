// frontend/src/utils/blogMeta.js
//
// The two meta formatters a blog card renders — PF-98.
//
// ⚠️ EXTRACTED, NOT INVENTED. Both functions lived in BlogSection.jsx from
// PF-86 until PF-98, and they move here because there are now TWO confirmed
// consumers — the home page's teaser (BlogSection) and the /blog index
// (BlogPage) — grepped, not assumed. That is the same bar that justified
// pulling `.section-eyebrow` out of AboutSection in PF-81.
//
// ⚠️ This is deliberately NOT the mistake PF-95 nearly made. That ticket
// proposed a new `utils/blog.js` for a date formatter that already existed
// two lines away inside BlogSection.jsx, with exactly one consumer. One
// consumer is a local function; two is a module.
//
// `byRecency` deliberately did NOT come with them. It still has one consumer,
// and /blog must not re-sort a list the server already ordered — a second
// sort rule that drifts from `backend/src/utils/blogQuery.js`'s is the PF-96
// ordering bug all over again.
//
// React-free and directly unit-testable, matching utils/theme.js,
// utils/motion.js, utils/nav.js and utils/splash.js.
//
// ⚠️ Named `blogMeta`, not `blogFormat`, to stay clearly distinct from the
// existing `utils/blogForm.js` (PF-97's admin-editor form helpers). Two
// modules one character apart is a mis-import waiting to happen.

/**
 * `14 JUL 2026` — the card meta date.
 *
 * ── ⚠️ RENAMED AND WIDENED IN PF-104 (owner-requested 2026-09-06) ─────
 * Was `formatMonth`, returning `JUL 2026` — the prototype's own format
 * (`Blog.dc.html`). The owner asked for the whole date, so the day is now
 * included, and the name changed with it: a function called `formatMonth`
 * returning a full date is a name that lies, and the rename is what makes
 * every call site declare which one it wanted.
 *
 * A sanctioned deviation from the frozen export. Both consumers changed
 * together — the /blog index and the home-page teaser — because two date
 * formats for the same posts on the same site reads as a defect.
 *
 * Callers pass `publishedAt || createdAt`. `publishedAt` is the post's own
 * publish date (PF-95); `createdAt` is Mongoose's record stamp, which
 * `insertMany` can write identically across a whole batch — so before PF-95
 * every seeded post rendered the same month. The fallback covers a post
 * written before the field existed, and the `NaN` guard covers neither being
 * present, returning `''` rather than `INVALID DATE`.
 *
 * ⚠️ The locale is pinned to `en-GB`, not the visitor's. A Sinhala or
 * Japanese locale renders a month name the design has no styling for, and
 * this label is uppercase mono at .12em tracking — a shape that only works
 * for a three-letter Latin abbreviation. Dropping the argument is invisible
 * in an assertion on the output string when the test machine happens to be
 * en-GB, which is why blogMeta.test.js spies on the ARGUMENT.
 *
 * ⚠️ `day: '2-digit'` and not `'numeric'`, so every card reads `04 MAY`
 * rather than `4 MAY`. The meta line is mono at .12em tracking and the
 * dates sit directly above one another down the grid; a one-character
 * width difference between the 9th and the 10th of a month is visible as
 * a ragged column.
 *
 * ⚠️ THE TIMEZONE CAVEAT IS UNCHANGED AND NOW SHOWS UP MORE OFTEN. This
 * renders in the READER'S timezone, so an instant near midnight UTC is a
 * different DAY either side of the date line — where before only a month
 * boundary could expose it. `2026-07-14T23:30:00Z` is `15 JUL` in
 * Colombo. Pinning to UTC would change dates that currently render
 * correctly for most readers, so it stays a product call, not a bug fix.
 */
export function formatDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase();
}

/**
 * `6 MIN READ` — `readingTimeMinutes` is a real schema field
 * (backend/src/models/Blog.js), derived by two hooks working together:
 * `pre('insertMany')` on raw seed objects, then `pre('validate')` on the
 * constructed Document. Nothing is computed here.
 */
export function formatReadTime(minutes) {
  return `${minutes} MIN READ`;
}
