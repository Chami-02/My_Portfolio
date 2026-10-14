// frontend/src/utils/aboutStats.js
//
// The About section's four stat cards, driven by `About.stats` instead of by a
// hardcoded array. React-free and directly unit-testable, matching the rest of
// utils/ — this module decides WHICH cards exist and whether each one counts;
// AboutSection decides how they look.
//
// WHY THIS EXISTS. `About.stats` has been in the model and in `seed.js` since
// Phase 1 and had ZERO frontend consumers — grep confirmed it, and a green suite
// says nothing about that, because a field nothing reads still round-trips
// through every API test. The four cards on screen were the literals in
// `AboutSection.jsx`'s own `STATS` const, so editing a stat anywhere changed
// nothing on the site. Same defect, and the same fix, as `utils/social.js`.

/**
 * The prototype's own four cards — `Portfolio Revolution.dc.html:215-228`.
 *
 * ⚠️ A FALLBACK ONLY, for a document with no stats at all (and for the first
 * paint before the query resolves). It is deliberately the same content the
 * page has always shown, so a failed fetch degrades to the old behaviour rather
 * than to an empty grid.
 */
export const DEFAULT_STATS = [
  { label: 'PROJECTS BUILT', value: '5+' },
  { label: 'TECHNOLOGIES',   value: '10+' },
  { label: 'GITHUB REPOS',   value: '5+' },
  { label: 'LEARNING',       value: 'Continuous' },
];

/**
 * The prototype's reveal delays — 200 / 250 / 300 / 350, a 50ms stagger
 * (`data-delay` on lines 215, 219, 223, 227).
 *
 * ⚠️ These were 50 / 50 / 50 / 350 in the code this module replaces, which is
 * NOT what the export says: the first three cards all arrived together and only
 * the fourth was staggered. `50` is the STEP between the prototype's delays, not
 * any one of its values, and that is almost certainly how it got transcribed.
 * Corrected here rather than carried forward — the prototype wins.
 *
 * A fifth card and beyond continues the same 50ms step rather than reusing 350,
 * so a longer row still arrives in order.
 */
const FIRST_DELAY = 200;
const DELAY_STEP  = 50;

export const statDelay = (index) => FIRST_DELAY + (index * DELAY_STEP);

/**
 * Split a stored value into something the card can render.
 *
 * `'5+'` → a CountUp to 5 with a '+' suffix. `'Continuous'` → the static word
 * card. That split already existed in the markup as two hand-written branches
 * (three counters plus one literal fourth card); all this does is decide it from
 * the DATA instead of from the position, so a stat the owner types as `'12'`
 * counts and one they type as `'Daily'` does not.
 *
 * ⚠️ `decimals` is derived from the digits the owner actually typed, not fixed
 * at 0. CountUp renders `to.toFixed(decimals)`, so a stored `'4.5+'` with
 * decimals 0 would count up to a visible `5+` — right-looking and wrong.
 */
export const parseStatValue = (value) => {
  const raw = String(value ?? '').trim();
  const match = /^(\d+(?:\.\d+)?)(.*)$/.exec(raw);

  if (!match) return { numeric: false, text: raw };

  const [, digits, rest] = match;
  const dot = digits.indexOf('.');

  return {
    numeric:  true,
    count:    Number(digits),
    decimals: dot === -1 ? 0 : digits.length - dot - 1,
    suffix:   rest.trim(),
  };
};

/**
 * Every stat card to render, already filtered, parsed and staggered.
 *
 * ⚠️ A row needs BOTH halves. The schema marks `label` and `value` required, so
 * a half-filled row cannot be SAVED — but it can exist in a document written
 * before those rules, and a card with an empty numeral is worse than no card.
 *
 * @param about the About document, or undefined while the query is in flight
 */
export const statCards = (about) => {
  // ⚠️ `Array.isArray` decides the fallback, NOT `.length`, and the difference
  // is the whole contract. A stats list the owner has deliberately emptied is
  // `[]`; falling back on it would put the four built-in cards straight back on
  // the page, which reads as the panel refusing to save. Only `undefined` — the
  // query still in flight, or a document written before the field existed —
  // takes the defaults.
  const stored = Array.isArray(about?.stats) ? about.stats : null;

  const source = stored === null ? DEFAULT_STATS : stored.filter(
    (row) => row && String(row.label ?? '').trim() && String(row.value ?? '').trim()
  );

  return source.map((row, index) => ({
    // ⚠️ The LABEL is the key, not the index. A key of `index` makes React reuse
    // a card's DOM across a reorder, and CountUp holds its animated value in
    // component state — so a reordered row would keep the previous card's
    // number while showing the new label.
    key:    `${String(row.label).trim()}-${index}`,
    label:  String(row.label).trim(),
    delay:  statDelay(index),
    ...parseStatValue(row.value),
  }));
};
