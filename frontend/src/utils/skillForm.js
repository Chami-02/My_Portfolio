// frontend/src/utils/skillForm.js
//
// PF-114 — the Skills panel's form as data. React-free and directly
// unit-testable, matching projectForm.js and blogForm.js.
//
// ⚠️ NO DRAFTS, deliberately (owner, 2026-10-05): a skill is a name, a
// category and a level — nothing long to hold back — so ADD publishes. This is
// the one admin panel the "new records SAVE AS DRAFT" rule does not reach, by
// decision rather than omission.

/** The Skill schema's level enum, in its own order (backend/src/models/Skill.js). */
export const LEVELS = ['beginner', 'intermediate', 'advanced'];

// PF-114 — CATEGORIES are no longer a constant. They are the owner's SECTIONS
// (GET /api/skill-categories), so every helper below that needs them takes the
// list as an argument.

/** Sections in display order, without sorting the cached array. */
export const sortedSections = (categories = []) =>
  categories.slice().sort((x, y) => (x.order ?? 0) - (y.order ?? 0));

/**
 * The section a new skill starts in: `frontend` when it exists (the
 * prototype's own default, Admin.dc.html:666), else the first section.
 */
export const defaultSectionKey = (categories = []) => {
  const keys = sortedSections(categories).map((c) => c.key);
  return keys.includes('frontend') ? 'frontend' : (keys[0] ?? '');
};

/**
 * A blank form. ⚠️ A FACTORY, not a constant — the blogForm.js lesson: a shared
 * object is one mutation away from leaking into every later form.
 * `frontend` / `beginner` are the prototype's own defaults (Admin.dc.html:666).
 */
export const emptySkillForm = (category = 'frontend') => ({ name: '', category, level: 'beginner' });

/** A stored skill as form fields; `null` gives a blank form. */
export const skillToForm = (skill) =>
  skill
    ? { name: skill.name ?? '', category: skill.category ?? 'frontend', level: skill.level ?? 'beginner' }
    : emptySkillForm();

/** What the server is sent. Trimmed here so "React " and "React" are one name. */
export const formToPayload = (form) => ({
  name:     String(form.name ?? '').trim(),
  category: form.category,
  level:    form.level,
});

/**
 * Do the fields differ from the stored skill? Compared through the PAYLOAD, so
 * whitespace typed and deleted is not an edit. About CHANGE, never validity.
 * The staged POSITION is not a field — the panel ORs it in (isOrderDirty).
 */
export const isSkillDirty = (form, skill) =>
  JSON.stringify(formToPayload(form)) !== JSON.stringify(formToPayload(skillToForm(skill)));

/**
 * The client half of the server's rules — a COURTESY, never the gate.
 *
 * @param skills       every stored skill, for the duplicate check
 * @param editingId    the skill being edited, which may of course keep its name
 * @param sectionKeys  the keys of the sections that exist (PF-114)
 *
 * ⚠️ The duplicate check is EXACT, case and all, because that is what the
 * server's `unique` index enforces. A case-insensitive check here would refuse
 * "Html" beside "HTML" while the server would accept it — the panel inventing
 * a rule the system does not have.
 */
export const skillFormErrors = (form, skills = [], editingId = null, sectionKeys = []) => {
  const errors = [];
  const name = String(form?.name ?? '').trim();

  if (!name) {
    errors.push({ field: 'name', message: 'Skill name is required.' });
  } else if (skills.some((s) => s._id !== editingId && s.name === name)) {
    errors.push({ field: 'name', message: `A skill named "${name}" already exists.` });
  }
  if (!sectionKeys.includes(form?.category)) {
    errors.push({ field: 'category', message: 'Choose a section.' });
  }
  if (!LEVELS.includes(form?.level)) {
    errors.push({ field: 'level', message: 'Choose a level.' });
  }
  return errors;
};

/**
 * The ids of one card, in display order. ⚠️ Sorted HERE, on a copy — the
 * array TanStack Query caches is never sorted in place.
 */
export const cardIds = (skills, category) =>
  skills
    .filter((s) => s.category === category)
    .slice()
    .sort((x, y) => (x.order ?? 0) - (y.order ?? 0))
    .map((s) => s._id);

/**
 * Move one id a step earlier (-1) or later (+1). Returns a NEW array; at either
 * end it returns the input unchanged, so a disabled arrow that somehow fires
 * still cannot reorder.
 */
export const moveWithin = (ids, id, dir) => {
  const from = ids.indexOf(id);
  const to = from + dir;
  if (from === -1 || to < 0 || to >= ids.length) return ids;
  const next = ids.slice();
  [next[from], next[to]] = [next[to], next[from]];
  return next;
};

/** Is a staged card order different from the stored one? `null` = nothing staged. */
export const isOrderDirty = (staged, stored) =>
  Array.isArray(staged) && staged.join() !== stored.join();

// ── PF-114: the LAYOUT — every box's ids, in order ───────────────────────────
// One staged layout serves both the ◀ ▶ arrows and drag-and-drop, so the two
// can never disagree about where a pill is.

/** `{ [sectionKey]: ids[] }` for every section, from what the server holds. */
export const layoutFrom = (skills, categories) =>
  Object.fromEntries(sortedSections(categories).map((c) => [c.key, cardIds(skills, c.key)]));

/**
 * The staged layout reconciled with the latest server data.
 *
 * ⚠️ Without this a staged drag goes STALE the moment the list refetches: a
 * skill added meanwhile would be missing from its box (not in the staged
 * arrays), and a skill deleted meanwhile would be sent back in a reorder the
 * server refuses as "not found". So: drop ids that no longer exist, then
 * append any stored id the staged layout does not place, in its stored box.
 */
export const mergeLayout = (staged, skills, categories) => {
  const stored = layoutFrom(skills, categories);
  if (!staged) return stored;
  const alive = new Set(skills.map((s) => s._id));
  const merged = {};
  const placed = new Set();
  for (const key of Object.keys(stored)) {
    merged[key] = (staged[key] ?? []).filter((id) => alive.has(id) && !placed.has(id));
    merged[key].forEach((id) => placed.add(id));
  }
  for (const [key, ids] of Object.entries(stored)) {
    for (const id of ids) if (!placed.has(id)) { merged[key].push(id); placed.add(id); }
  }
  return merged;
};

/**
 * Move one id to `toKey` at `toIndex` (clamped). Returns a NEW layout.
 * Dropping a pill on itself returns the input unchanged.
 */
export const moveInLayout = (layout, id, toKey, toIndex) => {
  if (!layout[toKey]) return layout;
  const fromKey = Object.keys(layout).find((k) => layout[k].includes(id));
  if (!fromKey) return layout;
  const next = Object.fromEntries(Object.entries(layout).map(([k, ids]) => [k, ids.slice()]));
  const fromIndex = next[fromKey].indexOf(id);
  next[fromKey].splice(fromIndex, 1);
  // Dropping later in the SAME box: removing the pill first shifted the slots.
  let at = fromKey === toKey && toIndex > fromIndex ? toIndex - 1 : toIndex;
  at = Math.max(0, Math.min(at, next[toKey].length));
  next[toKey].splice(at, 0, id);
  const same = next[fromKey].join() === layout[fromKey].join() &&
               next[toKey].join() === layout[toKey].join();
  return same ? layout : next;
};

/**
 * What SAVE has to send for a staged layout:
 *   moves    — skills whose box changed: `{ id, category }`, sent FIRST (the
 *              server appends a moved skill to the end of its new box)
 *   reorders — every box whose order differs, as its full id list, sent after
 */
export const layoutChanges = (staged, skills, categories) => {
  const stored = layoutFrom(skills, categories);
  const categoryOf = Object.fromEntries(skills.map((s) => [s._id, s.category]));
  const moves = [];
  const reorders = [];
  for (const [key, ids] of Object.entries(staged ?? {})) {
    for (const id of ids) if (categoryOf[id] !== key) moves.push({ id, category: key });
    if (ids.length > 0 && ids.join() !== (stored[key] ?? []).join()) reorders.push(ids);
  }
  return { moves, reorders };
};

/** Does a staged layout differ from the server at all? */
export const isLayoutDirty = (staged, skills, categories) => {
  const { moves, reorders } = layoutChanges(staged, skills, categories);
  return moves.length > 0 || reorders.length > 0;
};

// ── PF-114: the Sections card ────────────────────────────────────────────────

/**
 * Section-name errors. Names are unique CASE-INSENSITIVELY, mirroring the
 * server (skillCategoryController's labelTaken) — "Tools" and "tools" would
 * be two boxes nobody can tell apart in the dropdown.
 *
 * @param labels  `{ [id]: label }` — every section's (staged) name
 */
export const sectionErrors = (labels) => {
  const errors = [];
  const seen = new Map();
  for (const [id, raw] of Object.entries(labels)) {
    const label = String(raw ?? '').trim();
    const field = `labels.${id}`;
    if (!label) errors.push({ field, message: 'Section name is required.' });
    else if (label.length > 40) errors.push({ field, message: 'Keep it under 40 characters.' });
    else if (seen.has(label.toLowerCase())) errors.push({ field, message: `"${label}" is already a section.` });
    seen.set(label.toLowerCase(), id);
  }
  return errors;
};

/** The add-a-section field's errors, against the sections that exist. */
export const newSectionErrors = (label, categories = []) => {
  const name = String(label ?? '').trim();
  if (!name) return [{ field: 'newLabel', message: 'Name the section.' }];
  if (name.length > 40) return [{ field: 'newLabel', message: 'Keep it under 40 characters.' }];
  if (categories.some((c) => c.label.toLowerCase() === name.toLowerCase())) {
    return [{ field: 'newLabel', message: `"${name}" is already a section.` }];
  }
  return [];
};

/** 1 / 2 / 3 for a known level, 0 for anything else — the home page's dot count. */
export const levelRank = (level) => LEVELS.indexOf(level) + 1;
