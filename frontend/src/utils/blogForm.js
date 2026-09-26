// frontend/src/utils/blogForm.js
//
// PF-97 — the pure transforms between a Blog POST as the API returns it and
// the shape the admin editor holds in React state.
//
// ── WHY THIS FILE EXISTS ────────────────────────────────────────────────
// The admin Blog panel used to bind one textarea to `content`, a field
// PF-59 deprecated and that no post in this database has ever carried. The
// panel now edits `sections[]` directly, which means a real translation in
// both directions: an array of sections, each holding two arrays of
// strings, has to become editable state and then a clean payload again.
//
// That logic is branchy and easy to get silently wrong, so it lives here,
// React-free and directly unit-testable, exactly as every other file in
// `src/utils/` does. It is NOT speculative surface: none of these functions
// existed anywhere before, and the component cannot test them cleanly
// through rendered DOM.
//
// ── THE RULE THAT MATTERS MOST ──────────────────────────────────────────
// `postToForm` is an EXPLICIT PICK, not a spread. The panel previously did
// `setForm({ ...post })` and PUT the whole thing back — including `slug`,
// `views`, `publishedAt` and `readingTimeMinutes`, all of them server-owned
// derived or counted values. Echoing `readingTimeMinutes` back is the
// dangerous one: PF-95 made `pre('validate')` skip its recompute when that
// field is modified in the same operation, so a client that returns the old
// figure alongside rewritten sections is asking the server not to update
// it. Not sending the field at all removes the question rather than
// answering it.
//
// ⚠️ PF-103 ADDS `readingTimeOverride`, AND IT IS NOT THAT TRAP — the two
// names look alike and the distinction is the whole point. The rule above
// is about DERIVED values: `readingTimeMinutes` is computed by the server,
// so echoing it back is a client telling the server what it already knows,
// and getting it wrong. `readingTimeOverride` is AUTHORED — the same
// category as `title` or `excerpt` — so round-tripping it is not an echo,
// it is the field doing its job. `readingTimeMinutes` is still never sent.

/**
 * A blank section, as a FACTORY rather than a shared constant.
 *
 * A module-level `const EMPTY_SECTION = { body: [] }` would hand the same
 * two array instances to every section on the form, so typing a paragraph
 * into section 3 would append it to sections 1 and 2 as well — a spread
 * copies the object but not the arrays inside it. Returning a fresh object
 * each call is what makes each section independent.
 *
 * Starts with one empty paragraph so a newly added section has somewhere
 * to type immediately.
 */
export const emptySection = () => ({ heading: '', body: [''], bullets: [] });

/** A blank editor form, for "+ New Post". Same factory reasoning. */
export const emptyForm = () => ({
  title:     '',
  excerpt:   '',
  tags:      '',
  published: false,
  // A STRING, not a number or null, because the input binds to it. Blank
  // is the normal state and means "compute from the content".
  readingTimeOverride: '',
  sections:  [emptySection()],
});

/**
 * API post → editor state.
 *
 * Deliberately lossless: sections are copied exactly as stored, with no
 * empty paragraph inserted to "help", so that opening a post and saving it
 * unchanged round-trips to an identical payload. A UI convenience that
 * altered the data on load would make that impossible to assert.
 *
 * Server-owned fields are dropped on purpose — see the file header.
 */
export const postToForm = (post = {}) => ({
  title:     post.title   || '',
  excerpt:   post.excerpt || '',
  tags:      Array.isArray(post.tags) ? post.tags.join(', ') : '',
  published: Boolean(post.published),
  // `?? ''` and not `|| ''`: both null and undefined mean "no pin", but a
  // real pin of 0 is impossible (the schema floors at 1) so the two would
  // agree here anyway — `??` says which question is being asked.
  readingTimeOverride:
    post.readingTimeOverride == null ? '' : String(post.readingTimeOverride),
  sections:  Array.isArray(post.sections) && post.sections.length > 0
    ? post.sections.map((section) => ({
        heading: section.heading || '',
        // Copied into NEW arrays. Reusing the query cache's own arrays
        // would let an edit mutate TanStack Query's cached post in place,
        // so an abandoned edit would still show its changes in the list.
        body:    Array.isArray(section.body)    ? [...section.body]    : [],
        bullets: Array.isArray(section.bullets) ? [...section.bullets] : [],
      }))
    : [emptySection()],
});

/**
 * Editor state → API payload.
 *
 * Trims everything, drops blank paragraphs and bullets, and drops any
 * section left completely empty — the trace of a "+ Add Section" click the
 * user thought better of. A section with a heading but no text is NOT
 * dropped here; that is a mistake worth reporting, and `formErrors` reports
 * it.
 *
 * ⚠️ Never emits `content`. The panel does not edit it, so sending it would
 * either blank a legacy row or write a second copy of the body that
 * disagrees with `sections`.
 */
export const formToPayload = (form = {}) => {
  const sections = (form.sections || [])
    .map((section) => ({
      heading: (section.heading || '').trim(),
      body:    (section.body    || []).map((p) => p.trim()).filter(Boolean),
      bullets: (section.bullets || []).map((b) => b.trim()).filter(Boolean),
    }))
    .filter((section) => section.heading || section.body.length || section.bullets.length);

  // ⚠️ Blank sends an explicit `null`, it does not omit the key. Omitting
  // it would make "clear the pin" inexpressible — the server would keep the
  // old override forever, since absent means "unchanged" on a PUT. `null`
  // is what the API's `.optional({ nullable: true })` rule accepts.
  //
  // A non-numeric string also becomes null rather than NaN: NaN survives
  // JSON.stringify as `null` anyway, so spelling it out here keeps the
  // payload honest instead of relying on that.
  const pin = Number.parseInt(String(form.readingTimeOverride ?? '').trim(), 10);

  return {
    title:     (form.title   || '').trim(),
    excerpt:   (form.excerpt || '').trim(),
    tags:      (form.tags    || '').split(',').map((t) => t.trim()).filter(Boolean),
    published: Boolean(form.published),
    readingTimeOverride: Number.isFinite(pin) ? pin : null,
    sections,
  };
};

/**
 * The tags field is a single comma-separated STRING in form state, because
 * that is what the text input binds to. The chip picker needs to reason
 * about it as a list, so these three are the bridge.
 *
 * Transcribed from the design's own helpers, `Admin.dc.html:658-659`:
 *
 *     const splitList = v => String(v || '').split(',').map(t => t.trim()).filter(Boolean);
 *     const joinList  = a => a.join(', ');
 *
 * ⚠️ Comparison is case-INSENSITIVE but the stored casing is PRESERVED.
 * That is the design's behaviour (`toggleChip` compares with
 * `.toLowerCase()` and stores `value` untouched) and it is the right one:
 * typing "react" must not create a second tag beside "React", but the
 * vocabulary's own capitalisation is what should end up on the post.
 */
export const tagList = (tags) =>
  String(tags || '').split(',').map((t) => t.trim()).filter(Boolean);

export const hasTag = (tags, label) =>
  tagList(tags).some((t) => t.toLowerCase() === String(label).toLowerCase());

/** Add the tag if absent, remove it if present. Returns the new string. */
export const toggleTag = (tags, label) => {
  const current = tagList(tags);
  const next = hasTag(tags, label)
    ? current.filter((t) => t.toLowerCase() !== String(label).toLowerCase())
    : [...current, label];
  return next.join(', ');
};

/** Remove the tag if present. Used when a chip is deleted from the pool. */
export const removeTag = (tags, label) =>
  tagList(tags).filter((t) => t.toLowerCase() !== String(label).toLowerCase()).join(', ');

/** The server's own ceiling, from blogRules' `isLength({ max: 300 })`. */
const MAX_EXCERPT = 300;

/**
 * Everything that must be fixed before the post is worth sending.
 *
 * Returns `[{ field, message }]` — the shape `utils/formErrors.js` defines and
 * `useFormGuard` consumes, so each message prints under the input it belongs to
 * rather than in a list at the top of the editor.
 *
 * ⚠️ IT USED TO RETURN BARE STRINGS, and the change is what lets a message be
 * attached to a field at all. The list-at-the-top version could say "Section 02
 * needs a heading" and leave the author to count section cards.
 *
 * Mirrors the server's rules so a mistake is a mark on the field rather than a
 * round trip that returns a 400 — which is precisely how the inherited
 * `content` defect stayed invisible for two sprints.
 */
export const formErrors = (form = {}) => {
  const payload = formToPayload(form);
  const errors  = [];

  if (!payload.title) {
    errors.push({ field: 'title', message: 'Title is required.' });
  }

  if (!payload.excerpt) {
    errors.push({ field: 'excerpt', message: 'Excerpt is required.' });
  } else if (payload.excerpt.length > MAX_EXCERPT) {
    errors.push({
      field:   'excerpt',
      message: `Excerpt cannot exceed ${MAX_EXCERPT} characters — this one is ${payload.excerpt.length}.`,
    });
  }

  // ── ⚠️ ITERATE THE FORM'S SECTIONS, NEVER THE PAYLOAD'S ──────────────────
  //
  // This used to walk `payload.sections`, which was right when an error was
  // just a sentence and wrong the moment it had to name a field.
  // `formToPayload` FILTERS OUT empty sections (line 116), so an empty one
  // anywhere shifts every later index — and the marks would land on the wrong
  // section's inputs, one row up for each empty section above them. The form's
  // own indexes are what the JSX rendered, so they are the only ones that can
  // address an input.
  //
  // The payload's trimming rules are applied here by hand for the same reason
  // the old note gives: a section made entirely of whitespace must not pass.
  const sections = form.sections || [];

  // ⚠️ THE EMPTINESS CHECK ASKS THE PAYLOAD; only the per-section loop below
  // needs the form's indexes. They answer different questions: "would anything
  // be sent?" is about the payload, and a form holding one blank section — the
  // state `emptyForm()` starts in — has `sections.length === 1` while the
  // payload has none. Asking the form here would let an empty post save.
  const nothingToSend = payload.sections.length === 0;

  if (nothingToSend) {
    // Nothing on screen to point at, so it is reported against the title —
    // the first field of the form, and where the guard will send focus.
    errors.push({ field: 'title', message: 'Add at least one section — a post needs a body.' });
  }

  sections.forEach((section, i) => {
    const heading = (section?.heading || '').trim();
    const body    = (section?.body    || []).map((p) => (p || '').trim()).filter(Boolean);
    const bullets = (section?.bullets || []).map((b) => (b || '').trim()).filter(Boolean);

    // A completely empty section is dropped by the payload and is the normal
    // state of one just added, so it is not an error on its own — the
    // nothing-to-send check above covers the case where it is the only one.
    if (!heading && body.length === 0 && bullets.length === 0) return;

    const label = `Section ${String(i + 1).padStart(2, '0')}`;

    if (!heading) {
      errors.push({ field: `sections.${i}.heading`, message: `${label} needs a heading.` });
    }
    if (body.length === 0 && bullets.length === 0) {
      errors.push({
        field:   `sections.${i}.heading`,
        message: `${label} needs at least one paragraph or bullet.`,
      });
    }
  });

  return errors;
};
