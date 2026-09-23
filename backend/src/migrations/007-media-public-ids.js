#!/usr/bin/env node
// backend/src/migrations/007-media-public-ids.js
//
// PF-111 — bring existing documents onto the publicId-bearing media shape.
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
// Cloudinary can only delete a file by its public_id. Four fields stored a bare
// URL and no publicId, so replacing any of them orphaned the previous file in
// the bucket forever. PF-111 changed the schemas; this script changes the data
// that is already in a database.
//
// ── WHAT CHANGES ────────────────────────────────────────────────────────────
//   About    avatarUrl (String)  →  avatar.url, then avatarUrl is unset
//   Project  imageUrl            →  unset (bare String, zero consumers)
//   Project  backgroundImage     →  gains publicId: '' where absent
//   Blog     coverImage          →  unset (bare String, zero consumers)
//
// IDEMPOTENT: every step is conditional on the old field still being present,
// so a second run reports "already correct" for every document and writes
// nothing.
//
// NON-DESTRUCTIVE, with one stated exception: `imageUrl` and `coverImage` are
// REMOVED, not moved. That is the point of the ticket — both are leftovers with
// zero consumers in either package, and the owner approved deleting them at
// sprint planning. Any value they hold is printed before it is dropped, so a
// real run's log is the record of what was there. `avatarUrl` is MOVED, never
// dropped.
//
// ── ⚠️ THREE TRAPS SPECIFIC TO THIS SCRIPT ──────────────────────────────────
//
// 1. THE OLD FIELDS ARE INVISIBLE TO THE MODELS. This migration runs AFTER the
//    schema change, and Mongoose's `strict` mode silently drops paths a schema
//    does not declare — so `doc.avatarUrl` reads `undefined` on a document that
//    plainly has one in the database, and a model-based script would report
//    "nothing to do" against a database full of work. Everything here therefore
//    goes through the RAW DRIVER (`Model.collection`), which sees the document
//    as it actually is. This is not a style choice; a model-based version of
//    this file cannot work.
//
// 2. `.save()` CANNOT REMOVE A FIELD. Unsetting is a `$unset` update, which is
//    a raw-collection operation, which means no Mongoose middleware runs on
//    this path. That is correct here — nothing in these three models derives
//    anything from the fields being touched — and it is written down so the
//    absence of hooks is not later read as an oversight and "fixed".
//
// 3. NEVER `validateSync()`. It runs no middleware and returns `undefined` for
//    a valid document exactly as it does for a successful validation. That is
//    what made migration 006's dry run print `Already correct: 4` — the same
//    output a correct run produces. Nothing in this script needs a derived
//    value, so nothing here validates at all; if that ever changes, the call is
//    `await doc.validate()`.
//
// ⚠️ A DRY RUN THAT FINDS NOTHING LOOKS EXACTLY LIKE A CLEAN DATABASE. Before
// trusting `Already correct` on a database you have not just inspected, plant
// the dirty state and check this script SEES it:
//
//   node -e "require('dotenv').config();const m=require('mongoose');
//     m.connect(process.env.MONGO_URI).then(async()=>{
//       await m.connection.collection('abouts').updateOne({},
//         {\$set:{avatarUrl:'https://example.com/old.png'}});
//       await m.disconnect();})"
//
// then re-run with --dry-run. A working script reports 1 About to migrate; a
// broken one still reports `Already correct`.
//
// Usage:
//   node src/migrations/007-media-public-ids.js --dry-run
//   node src/migrations/007-media-public-ids.js

require('dotenv').config();
const mongoose = require('mongoose');
const About   = require('../models/About');
const Project = require('../models/Project');
const Blog    = require('../models/Blog');
const { databaseNameFrom } = require('../config/db');

// ⚠️ READ INSIDE run(), NOT AT MODULE SCOPE. Capturing this as a module-level
// const — the shape migrations 001-006 use — binds the flag to whatever argv
// happened to hold when the file was first require()d. That is correct for the
// `node script.js --dry-run` path, where argv is set before the require, and
// silently WRONG for every programmatic caller: importing { run } and calling
// it yields a LIVE run no matter what argv says afterwards. Found by this
// migration's own test, which passed --dry-run and watched it write.
const isDryRun = () => process.argv.includes('--dry-run');

/** The empty portrait slot, matching About.js's schema defaults exactly. */
const EMPTY_AVATAR = {
  url: '', publicId: '', fileName: '', format: '',
  bytes: 0, width: 0, height: 0, uploadedAt: null,
};

async function run() {
  const DRY_RUN = isDryRun();

  // Printed unconditionally, dry-run or not. MONGO_URI defaults to
  // portfolio_dev since the 2026-08-31 restructure, so which database is about
  // to be touched is never something to infer from habit.
  const targetDb = databaseNameFrom(process.env.MONGO_URI);

  console.log('');
  console.log(`Target database: ${targetDb ?? '(none — MONGO_URI has no database name)'}`);
  console.log(`Mode:            ${DRY_RUN ? 'DRY RUN — writes nothing' : 'LIVE — will write'}`);
  if (!DRY_RUN && targetDb === 'portfolio_prod') {
    console.log('⚠️  This is a REAL RUN against portfolio_prod.');
  }
  console.log('─'.repeat(56));

  await mongoose.connect(process.env.MONGO_URI);

  let updated = 0;
  let already = 0;

  // ── About: avatarUrl → avatar{} ───────────────────────────────────────────
  console.log('\nAbout');
  const abouts = await About.collection.find({}).toArray();

  for (const doc of abouts) {
    const legacyUrl  = typeof doc.avatarUrl === 'string' ? doc.avatarUrl.trim() : '';
    const hasLegacy  = Object.prototype.hasOwnProperty.call(doc, 'avatarUrl');
    const hasAvatar  = doc.avatar && typeof doc.avatar === 'object';

    if (!hasLegacy && hasAvatar) {
      console.log(`  ✅ OK       ${doc._id}  (avatar already present)`);
      already += 1;
      continue;
    }

    // ⚠️ publicId is left EMPTY for a migrated URL and that is not a gap this
    // script can close. A bare URL never recorded one, and Cloudinary's
    // public_id is not derivable from a delivery URL in the general case
    // (transformations, versions and folder prefixes all appear in the path).
    // The one such file, if any exists, stays in the bucket; every file
    // uploaded from here on carries its publicId and is deletable.
    const avatar = { ...EMPTY_AVATAR, ...(hasAvatar ? doc.avatar : {}) };
    if (legacyUrl && !avatar.url) avatar.url = legacyUrl;

    console.log(
      `  ${DRY_RUN ? '🔎 WOULD  ' : '✏️  UPDATE'}  ${doc._id}\n` +
        `       avatarUrl  ${legacyUrl || '(empty)'} → unset\n` +
        `       avatar.url ${avatar.url || '(empty)'}` +
        (avatar.url && !avatar.publicId ? '   ⚠️ no publicId — old file not deletable' : '')
    );

    if (!DRY_RUN) {
      await About.collection.updateOne(
        { _id: doc._id },
        { $set: { avatar }, $unset: { avatarUrl: '' } }
      );
    }
    updated += 1;
  }
  if (abouts.length === 0) console.log('  (no About document)');

  // ── Project: drop imageUrl, add backgroundImage.publicId ──────────────────
  console.log('\nProjects');
  const projects = await Project.collection.find({}).toArray();

  for (const doc of projects) {
    const hasImageUrl = Object.prototype.hasOwnProperty.call(doc, 'imageUrl');
    const bg          = doc.backgroundImage;
    const needsPublicId =
      bg && typeof bg === 'object' &&
      !Object.prototype.hasOwnProperty.call(bg, 'publicId');

    if (!hasImageUrl && !needsPublicId) {
      console.log(`  ✅ OK       ${doc.title}`);
      already += 1;
      continue;
    }

    const lines = [];
    if (hasImageUrl)    lines.push(`       imageUrl                 ${doc.imageUrl ?? 'null'} → unset`);
    if (needsPublicId)  lines.push(`       backgroundImage.publicId (absent) → ''`);

    console.log(`  ${DRY_RUN ? '🔎 WOULD  ' : '✏️  UPDATE'}  ${doc.title}\n${lines.join('\n')}`);

    if (!DRY_RUN) {
      const update = {};
      if (needsPublicId) update.$set   = { 'backgroundImage.publicId': '' };
      if (hasImageUrl)   update.$unset = { imageUrl: '' };
      await Project.collection.updateOne({ _id: doc._id }, update);
    }
    updated += 1;
  }
  if (projects.length === 0) console.log('  (no projects)');

  // ── Blog: drop coverImage ─────────────────────────────────────────────────
  console.log('\nBlog posts');
  const posts = await Blog.collection.find({}).toArray();

  for (const doc of posts) {
    if (!Object.prototype.hasOwnProperty.call(doc, 'coverImage')) {
      console.log(`  ✅ OK       ${doc.title}`);
      already += 1;
      continue;
    }

    console.log(
      `  ${DRY_RUN ? '🔎 WOULD  ' : '✏️  UPDATE'}  ${doc.title}\n` +
        `       coverImage ${doc.coverImage ?? 'null'} → unset`
    );

    if (!DRY_RUN) {
      await Blog.collection.updateOne({ _id: doc._id }, { $unset: { coverImage: '' } });
    }
    updated += 1;
  }
  if (posts.length === 0) console.log('  (no posts)');

  console.log('\n' + '─'.repeat(56));
  console.log(
    `Documents: ${abouts.length + projects.length + posts.length}   ` +
    `Updated: ${updated}   Already correct: ${already}`
  );
  if (DRY_RUN) console.log('\nDRY RUN — no changes were written.');
  console.log('');

  await mongoose.disconnect();
}

if (require.main === module) {
  run().catch((err) => {
    console.error('\n💥 Migration crashed:', err);
    process.exit(1);
  });
}

module.exports = { run, EMPTY_AVATAR };
