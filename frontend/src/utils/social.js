// frontend/src/utils/social.js
//
// PF-112 — which social links the public site shows, and in what order.
//
// WHY THIS EXISTS. The Footer hardcoded five URLs in an array and Contact
// hardcoded two in JSX, so editing them in the admin panel changed nothing. The
// backend has said what the rule should be since PF-60 — `About.js`, on the
// deliberately-empty twitter field: "the public site must treat an empty value
// as 'hide this icon', not render a dead link." Nothing implemented it.
//
// React-free and directly unit-testable, matching utils/nav.js, utils/theme.js
// and utils/resume.js. ⚠️ The key→glyph map deliberately does NOT live here —
// see components/icons/socialIcons.js. This module decides which rows exist and
// in what order; that one decides how they look.

/**
 * The five fixed platforms, in the Footer's existing order.
 *
 * ⚠️ Order is transcribed, not alphabetical, and email comes LAST — matching
 * `Footer.jsx`'s original ELSEWHERE array exactly, so this change moves no row
 * that a visitor already knew the position of.
 */
const FIXED = [
  { key: 'github',    label: 'GitHub' },
  { key: 'linkedin',  label: 'LinkedIn' },
  { key: 'facebook',  label: 'Facebook' },
  { key: 'instagram', label: 'Instagram' },
  // ⚠️ Renderable for the first time in PF-112. The field has been fillable
  // since PF-60 but there was no Twitter glyph in the repo, so filling it in
  // produced nothing — and produced no error either.
  { key: 'twitter',   label: 'Twitter' },
];

const isUsable = (url) => typeof url === 'string' && url.trim().length > 0;

/**
 * Every social row to render, already filtered and ordered.
 *
 * Returns plain data — `{ key, label, href, external }` — so both the Footer and
 * any future consumer agree on the list without agreeing on the markup.
 *
 * ⚠️ `suffix` is the caller's business. The Footer wants "GitHub ↗" and Contact
 * wants "GITHUB"; baking either in here would force the other to strip it.
 *
 * @param about the About document, or undefined while the query is in flight
 */
export const socialEntries = (about) => {
  const social = about?.social ?? {};

  const fixed = FIXED
    .filter(({ key }) => isUsable(social[key]))
    .map(({ key, label }) => ({
      key,
      label,
      href: social[key].trim(),
      external: true,
    }));

  // ⚠️ Custom rows keep their stored order — the order the owner added them in.
  // Sorting them would silently reorder the footer on every save.
  const custom = (Array.isArray(about?.socialExtra) ? about.socialExtra : [])
    .filter((row) => row && isUsable(row.url) && isUsable(row.label))
    .map((row) => ({
      // ⚠️ Namespaced so a custom link named "github" cannot collide with the
      // fixed key and take its brand glyph. `iconFor` will not match this, which
      // is correct: every custom row gets the generic link icon.
      key: `extra:${row.label.trim()}`,
      label: row.label.trim(),
      href: row.url.trim(),
      external: true,
    }));

  // Email last, and built from the ONE top-level address rather than a
  // social.email — the model has a standing note against adding a second.
  const email = isUsable(about?.email)
    ? [{ key: 'email', label: 'Email', href: `mailto:${about.email.trim()}`, external: false }]
    : [];

  return [...fixed, ...custom, ...email];
};
