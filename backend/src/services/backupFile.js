const mongoose      = require('mongoose');
const About         = require('../models/About');
const Project       = require('../models/Project');
const Skill         = require('../models/Skill');
const SkillCategory = require('../models/SkillCategory');
const Blog          = require('../models/Blog');
const Vocabulary    = require('../models/Vocabulary');
const Contact       = require('../models/Contact');
const Migration     = require('../models/Migration');
const BackupSnapshot = require('../models/BackupSnapshot');
const AppError      = require('../utils/AppError');

// PF-135 — the backup file, both directions: build it (download, safety
// copy), check it (download self-check, restore preview, restore), and write
// it back (restore). One module, so the file the site writes and the file it
// accepts can never drift apart.
//
// ── The restore follows the standard for restores, not for imports ────────
// (owner, 2026-10-30: "follow the standard rules"). Database and site-backup
// tools — pg_restore --single-transaction, mongorestore, WordPress/Shopify
// backups — restore ALL or NOTHING: one bad row and nothing changes, with the
// exact problems listed. Skipping or fixing rows one by one is what IMPORT
// wizards do with someone else's data; a restore promises "the site exactly
// as it was", and a half-restored site is a state that never existed.
//
// Two guards make sure the owner's own untouched backups always restore:
//   1. every DOWNLOAD runs `validateBackup` on the file it just built, so a
//      file that would not restore is flagged the moment it is made;
//   2. old files are UPGRADED: `UPGRADES[n]` turns a version n+1 file into
//      version n+2. A ticket that tightens a content rule adds a step and
//      bumps VERSION (backup.restore.test.js pins VERSION = UPGRADES + 1).
//
// ── Every file is untrusted input, even the owner's own ───────────────────
// (OWASP Input Validation, Mass Assignment, NoSQL injection.) A file can be
// edited or damaged after it left the site, so every row goes through the
// real model validators (strict: unknown fields are dropped), ids must be
// real ObjectIds, keys that could act as Mongo operators or reach an object
// prototype are refused, and media must point at our own Cloudinary folder.

const FORMAT  = 'portfolio-backup';
const VERSION = 1;

/** `UPGRADES[n]` : (file at version n+1) => file at version n+2. Empty: v1 is the first. */
const UPGRADES = [];

/** Model name → key in the file. About is ONE document, the rest are lists. */
const BACKED_UP = {
  About:         'about',
  Project:       'projects',
  Skill:         'skills',
  SkillCategory: 'skillCategories',
  Blog:          'blog',
  Vocabulary:    'vocabulary',
  Contact:       'messages',
};

/** Accounts, credentials, sign-in records, plumbing and the safety copies — never in a backup. */
const NEVER_BACKED_UP = [
  'User', 'Session', 'PasswordReset', 'PasswordChange', 'OAuthFlow',
  'SignInEvent', 'RateLimit', 'Migration', 'BackupSnapshot',
];

/** The six lists, in the order they are written. Messages last: they MERGE. */
const LISTS = [
  { key: 'skillCategories', Model: SkillCategory, label: 'Skill section', name: 'label' },
  { key: 'skills',          Model: Skill,         label: 'Skill',         name: 'name' },
  { key: 'projects',        Model: Project,       label: 'Project',       name: 'title' },
  { key: 'blog',            Model: Blog,          label: 'Blog post',     name: 'title' },
  { key: 'vocabulary',      Model: Vocabulary,    label: 'Tag/tech',      name: 'value' },
  { key: 'messages',        Model: Contact,       label: 'Message',       name: 'name' },
];
const LIST_KEYS = LISTS.map((l) => l.key);

/** Far above any real site (the E2E site is ~200 rows); bounds the work a file can ask for. */
const MAX_ROWS = 5000;
/** Enough to act on; the rest are counted, not listed. */
const MAX_PROBLEMS = 20;
/** Safety copies kept (owner, 2026-10-30). */
const SAFETY_COPIES = 3;

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Every model's own validators, unique keys and links — the rows' checks. */
const UNIQUE = {
  skillCategories: (row) => row.key,
  skills:          (row) => row.name,
  blog:            (row) => row.slug,
  vocabulary:      (row) => `${row.type}\u0000${row.value}`,
};

// ── Build ─────────────────────────────────────────────────────────────────────

/**
 * Everything the site says, as the file holds it. Every field is kept —
 * `_id` and timestamps included, so a restore puts rows back as they were —
 * except Mongoose's `__v`. `schema.migrations` names the migrations this
 * database has run, so a restore can refuse a file from a NEWER schema.
 *
 * @param {{ session?: import('mongoose').ClientSession }} [opts]  read inside a transaction
 */
const buildBackup = async ({ session = null } = {}) => {
  // Sorted by `_id` (creation order): the same site always gives the same
  // file, so two backups can be compared line by line.
  const read = (query) => query.select('-__v').sort({ _id: 1 }).lean().session(session);
  const queries = [
    () => read(About.findOne()),
    () => read(Project.find()),
    () => read(Skill.find()),
    () => read(SkillCategory.find()),
    () => read(Blog.find()),
    () => read(Vocabulary.find()),
    () => read(Contact.find()),
    () => Migration.find().select('name').sort({ name: 1 }).lean().session(session),
  ];
  // ⚠️ One at a time INSIDE a transaction: MongoDB refuses parallel operations
  // on one transaction's session ("Only servers in a sharded cluster can start
  // a new transaction at the active transaction number"). In parallel otherwise.
  const results = [];
  if (session) for (const q of queries) results.push(await q());
  const [about, projects, skills, skillCategories, blog, vocabulary, messages, migrations] =
    session ? results : await Promise.all(queries.map((q) => q()));
  const lists = { projects, skills, skillCategories, blog, vocabulary, messages };

  return {
    format:    FORMAT,
    version:   VERSION,
    createdAt: new Date().toISOString(),
    schema:    { migrations: migrations.map((m) => m.name) },
    counts:    Object.fromEntries(Object.entries(lists).map(([key, rows]) => [key, rows.length])),
    about,
    ...lists,
  };
};

// ── Check ─────────────────────────────────────────────────────────────────────

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** First key anywhere in `value` that could act as an operator or reach a prototype. */
const findForbiddenKey = (value, path = '') => {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const hit = findForbiddenKey(value[i], `${path}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  if (!isPlainObject(value)) return null;
  for (const key of Object.keys(value)) {
    const here = path ? `${path}.${key}` : key;
    if (key.startsWith('$') || FORBIDDEN_KEYS.has(key)) return here;
    const hit = findForbiddenKey(value[key], here);
    if (hit) return hit;
  }
  return null;
};

/** "Blog post 3 (“My title”)" — the reader can find the row without counting. */
const rowLabel = ({ label, name }, row, i) => {
  const title = typeof row?.[name] === 'string' && row[name].trim() ? ` (“${row[name].trim().slice(0, 60)}”)` : '';
  return `${label} ${i + 1}${title}`;
};

const isObjectIdString = (v) => typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v);

/**
 * Media fields are objects with a `publicId` (About's résumé, portrait and
 * hero image; a project's background). Each must be either empty, or a file
 * in OUR Cloudinary folder whose link names that file. This keeps the locked
 * rule "never a client-supplied publicId": a later REPLACE destroys the old
 * file by its id, so a tampered id could otherwise delete a file that is not
 * the site's.
 */
const mediaProblems = (row, where) => {
  const problems = [];
  const folder = process.env.CLOUDINARY_FOLDER || 'portfolio';
  const cloud  = process.env.CLOUDINARY_CLOUD_NAME || '';
  const walk = (value, path) => {
    if (Array.isArray(value)) return value.forEach((v, i) => walk(v, `${path}[${i}]`));
    if (!isPlainObject(value)) return;
    if ('publicId' in value) {
      const id  = typeof value.publicId === 'string' ? value.publicId : '';
      const url = typeof value.url === 'string' ? value.url : (typeof value.src === 'string' ? value.src : '');
      if (id || url) {
        let parsed = null;
        try { parsed = new URL(url); } catch { /* reported below */ }
        const ours = parsed
          && parsed.protocol === 'https:'
          && parsed.hostname === 'res.cloudinary.com'
          && (!cloud || parsed.pathname.startsWith(`/${cloud}/`));
        if (!id || !url || !ours || !id.startsWith(`${folder}/`) || !parsed.pathname.includes(`/${id}`)) {
          problems.push(`${where}: ${path || 'media'} — the file link is not one this site uploaded`);
        }
      }
    }
    Object.entries(value).forEach(([key, v]) => walk(v, path ? `${path}.${key}` : key));
  };
  walk(row, '');
  return problems;
};

/** Mongoose's validation messages, one per field, as "Where: field — message". */
const validationProblems = async (doc, where) => {
  try {
    await doc.validate();
    return [];
  } catch (err) {
    if (!(err instanceof mongoose.Error.ValidationError)) throw err;
    return Object.values(err.errors).map((e) => `${where}: ${e.path} — ${e.kind === 'ObjectId' || e.name === 'CastError' ? 'not a valid value' : e.message}`);
  }
};

/**
 * One row → its problems, or the exact document to write. Three steps, each
 * for a reason found by measuring (PF-135):
 *
 *   1. `new Model(raw).validate()` — every problem, wrong types included.
 *   2. a FRESH `new Model(raw).toObject()` — strict mode: a field the schema
 *      does not have is dropped (mass assignment). Values are cast (dates,
 *      ids) and setters applied.
 *   3. `Model.hydrate(clean).validate()` — loaded as an EXISTING document,
 *      so nothing counts as "modified". ⚠️ Without this, Blog's
 *      pre('validate') sees a modified title and REGENERATES the slug: a
 *      post renamed after publishing would come back at a different URL.
 *      Derived fields that are pure functions (reading time) recompute to
 *      the same value; a stored `publishedAt` is never touched.
 *
 * The row is then written with the DRIVER (restoreBackup), so no Mongoose
 * hook gets a second chance to rewrite it.
 */
/**
 * The document as STORED. ⚠️ `virtuals: false` is load-bearing: About's
 * schema turns virtuals ON for toObject (hasAvatar, hasResume, id), and
 * the driver would write them as real fields. Found by the round-trip test.
 */
const STORED = { versionKey: false, virtuals: false, getters: false, depopulate: true };

const checkRow = async (Model, raw, where) => {
  const problems = [
    ...await validationProblems(new Model(raw), where),
    ...mediaProblems(raw, where),
  ];
  if (problems.length) return { problems, row: null };
  const loaded = Model.hydrate(new Model(raw).toObject(STORED));
  const again = await validationProblems(loaded, where);
  if (again.length) return { problems: again, row: null };
  // A fresh document's version, as Mongoose's own insert writes it.
  const { versionKey } = Model.schema.options;
  return { problems: [], row: { ...loaded.toObject(STORED), ...(versionKey ? { [versionKey]: 0 } : {}) } };
};

/**
 * Check a parsed backup file, change nothing.
 *
 * @returns {Promise<{ problems: string[], summary: object|null, rows: object|null }>}
 *   `rows` (About + the six lists, as plain documents ready to insert) only
 *   when there are no problems. `problems` lists at most MAX_PROBLEMS, then
 *   "…and N more".
 */
const validateBackup = async (input) => {
  const problems = [];
  const done = () => {
    const shown = problems.slice(0, MAX_PROBLEMS);
    if (problems.length > MAX_PROBLEMS) shown.push(`…and ${problems.length - MAX_PROBLEMS} more`);
    return { problems: shown, summary: null, rows: null };
  };

  // ── The envelope ──
  if (!isPlainObject(input) || input.format !== FORMAT) {
    problems.push('This is not a portfolio backup file — choose a file DOWNLOAD BACKUP saved.');
    return done();
  }
  const forbidden = findForbiddenKey(input);
  if (forbidden) {
    problems.push(`The file contains a key the site never writes (“${forbidden}”) — it has been edited.`);
    return done();
  }
  if (!Number.isInteger(input.version) || input.version < 1) {
    problems.push('The file has no valid version number — it has been edited or damaged.');
    return done();
  }
  if (input.version > VERSION) {
    problems.push('This backup was made by a newer version of the site. Update the site, then restore it.');
    return done();
  }
  let file = input;
  for (let v = file.version; v < VERSION; v += 1) file = UPGRADES[v - 1](file);

  const migrations = file.schema?.migrations;
  if (!Array.isArray(migrations) || !migrations.every((m) => typeof m === 'string')) {
    problems.push('The file has no valid schema list — it has been edited or damaged.');
    return done();
  }
  const applied = new Set(await Migration.distinct('name'));
  const newer = migrations.filter((m) => !applied.has(m));
  if (newer.length) {
    problems.push(`This backup was made after a database update this site has not had yet (${newer.join(', ')}). Update the site, then restore it.`);
    return done();
  }

  if (file.about !== null && !isPlainObject(file.about)) problems.push('About — not a valid section.');
  for (const key of LIST_KEYS) {
    if (!Array.isArray(file[key])) problems.push(`The “${key}” list is missing — the file has been edited or damaged.`);
    else if (file[key].length > MAX_ROWS) problems.push(`The “${key}” list has more than ${MAX_ROWS} rows.`);
    else if (file.counts?.[key] !== file[key].length) {
      problems.push(`The “${key}” list should have ${file.counts?.[key]} rows but has ${file[key].length} — the file is incomplete or edited.`);
    }
  }
  if (problems.length) return done();

  // ── Every row, through its model ──
  const rows = { about: null };

  if (file.about) {
    const where = 'About';
    if (file.about._id !== undefined && !isObjectIdString(file.about._id)) problems.push(`${where}: _id — not a valid id`);
    else {
      const checked = await checkRow(About, file.about, where);
      problems.push(...checked.problems);
      rows.about = checked.row;
    }
  }

  const sections = new Set();
  for (const list of LISTS) {
    rows[list.key] = [];
    const ids = new Set();
    const unique = new Map();
    for (let i = 0; i < file[list.key].length; i += 1) {
      const raw = file[list.key][i];
      const where = rowLabel(list, raw, i);
      if (!isPlainObject(raw)) { problems.push(`${where}: not a valid row`); continue; }
      if (!isObjectIdString(raw._id)) { problems.push(`${where}: _id — not a valid id`); continue; }
      if (ids.has(raw._id.toLowerCase())) { problems.push(`${where}: _id — appears twice in the file`); continue; }
      ids.add(raw._id.toLowerCase());

      const { problems: found, row } = await checkRow(list.Model, raw, where);
      if (found.length) { problems.push(...found); continue; }

      // skillController's rule: a skill belongs to a section that exists.
      // Sections are checked first (LISTS order), so this sees every valid one.
      if (list.key === 'skills' && !sections.has(row.category)) {
        problems.push(`${where}: category — the section “${row.category}” is not in the file`);
        continue;
      }

      const uniqueKey = UNIQUE[list.key]?.(row);
      if (uniqueKey !== undefined) {
        if (unique.has(uniqueKey)) {
          problems.push(`${where}: the same as ${unique.get(uniqueKey)} — each must be different`);
          continue;
        }
        unique.set(uniqueKey, where);
      }
      rows[list.key].push(row);
      if (list.key === 'skillCategories') sections.add(row.key);
    }
  }

  if (problems.length) return done();

  return {
    problems: [],
    rows,
    summary: {
      createdAt: typeof file.createdAt === 'string' ? file.createdAt : null,
      version:   input.version,
      counts:    Object.fromEntries(LIST_KEYS.map((key) => [key, rows[key].length])),
      hasAbout:  rows.about !== null,
    },
  };
};

// ── Restore ───────────────────────────────────────────────────────────────────

const NO_TRANSACTIONS = /Transaction numbers are only allowed|transactions are not supported|requires a replica set/i;

/**
 * Write a CHECKED backup (the `rows` of validateBackup) in ONE transaction:
 * safety copy first, then the content replaced, messages merged. Any failure
 * rolls everything back — the safety copy too. `withTransaction` retries the
 * whole step on a transient conflict, and every step in it is repeatable.
 *
 * Messages MERGE (owner, 2026-10-30): every message the site has now stays as
 * it is (read and star untouched); a message in the backup that the site no
 * longer has comes back. A restore never deletes real visitor mail.
 *
 * @returns {Promise<{ snapshotId, counts, messagesAdded }>}
 */
const restoreBackup = async (rows) => {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const current = await buildBackup({ session });
      const [snapshot] = await BackupSnapshot.create(
        [{ data: JSON.stringify(current), counts: current.counts, reason: 'before-restore' }],
        { session },
      );
      const older = await BackupSnapshot.find().sort({ createdAt: -1, _id: -1 })
        .skip(SAFETY_COPIES).select('_id').lean().session(session);
      if (older.length) await BackupSnapshot.deleteMany({ _id: { $in: older.map((o) => o._id) } }, { session });

      // The DRIVER's insertMany, not Mongoose's: the rows are already the
      // exact checked documents (checkRow), and Mongoose's insertMany would
      // run the hooks again — Blog's would regenerate every slug.
      const write = async (Model, docs) => {
        await Model.deleteMany({}, { session });
        if (docs.length) await Model.collection.insertMany(docs, { session });
      };
      await write(About, rows.about ? [rows.about] : []);
      for (const { key, Model } of LISTS) {
        if (key !== 'messages') await write(Model, rows[key]);
      }

      const have = new Set((await Contact.find({ _id: { $in: rows.messages.map((m) => m._id) } })
        .select('_id').lean().session(session)).map((m) => String(m._id)));
      const missing = rows.messages.filter((m) => !have.has(String(m._id)));
      if (missing.length) await Contact.collection.insertMany(missing, { session });

      result = {
        snapshotId:    snapshot._id,
        messagesAdded: missing.length,
        counts:        Object.fromEntries(LIST_KEYS.map((key) => [key, rows[key].length])),
      };
    });
  } catch (err) {
    if (NO_TRANSACTIONS.test(err.message || '')) {
      throw new AppError('Restore needs a database that supports transactions (a replica set). Nothing was changed.', 503);
    }
    throw err;
  } finally {
    await session.endSession();
  }
  return result;
};

module.exports = {
  FORMAT, VERSION, UPGRADES, BACKED_UP, NEVER_BACKED_UP, SAFETY_COPIES, MAX_ROWS,
  buildBackup, validateBackup, restoreBackup,
};
