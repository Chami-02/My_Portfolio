#!/usr/bin/env node
// backend/src/migrations/011-blog-content-removal.js
//
// PF-137 — the CONTRACT half of PF-59: `Blog.content` leaves the data.
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
// PF-59 (migration 001) EXPANDED a post's body from one Markdown string,
// `content`, into `sections[]`, and kept `content` as a rollback net. Since
// then nothing writes it (PF-97), nothing sends it to a reader (PF-120) and the
// schema path is gone (PF-137). This removes what is left in the database, so
// a field no code knows about cannot come back through a backup or a probe.
//
// ── ⚠️ A post whose ONLY text is `content` is REFUSED, not unset ────────────
// A row with a non-blank `content` and no sections was never converted by
// 001: `content` is the only copy of that post. Unsetting it would delete the
// post's text and log `UNSET` — exactly what a correct run also says. So the
// run counts every row FIRST and, if any is BLOCKED, writes nothing at all and
// fails (exit 1). In the deploy pipeline that stops the release before Deploy.
// Convert the post (001, or by hand in the panel), then run this again.
//
// Raw driver throughout (migration 007's rule) — the model no longer has the
// path, and `.save()` cannot remove a field; `$unset` can.
//
// Idempotent: a second run finds no `content` anywhere and reports OK.
//
// Usage:
//   node src/migrations/011-blog-content-removal.js --dry-run
//   node src/migrations/011-blog-content-removal.js

require('dotenv').config();
const mongoose = require('mongoose');
const { databaseNameFrom } = require('../config/db');

const isDryRun = () => process.argv.includes('--dry-run');

const hasText = (value) => typeof value === 'string' && value.trim() !== '';

/** 'ok' (no field) | 'unset' (safe to drop) | 'blocked' (content is the only copy). */
function classify(doc) {
  if (!Object.prototype.hasOwnProperty.call(doc, 'content')) return 'ok';
  const hasSections = Array.isArray(doc.sections) && doc.sections.length > 0;
  return hasText(doc.content) && !hasSections ? 'blocked' : 'unset';
}

async function run() {
  const DRY_RUN = isDryRun();
  const targetDb = databaseNameFrom(process.env.MONGO_URI);

  console.log('');
  console.log(`Target database: ${targetDb ?? '(none — MONGO_URI has no database name)'}`);
  console.log(`Mode:            ${DRY_RUN ? 'DRY RUN — writes nothing' : 'LIVE — will write'}`);
  if (!DRY_RUN && targetDb === 'portfolio_prod') {
    console.log('⚠️  This is a REAL RUN against portfolio_prod.');
  }
  console.log('─'.repeat(56));

  await mongoose.connect(process.env.MONGO_URI);
  try {
    const blogs = mongoose.connection.collection('blogs');
    const docs = await blogs
      .find({}, { projection: { title: 1, content: 1, sections: 1 } })
      .toArray();

    const counts = { ok: 0, unset: 0, blocked: 0 };
    const toUnset = [];

    console.log('\nBlog');
    for (const doc of docs) {
      const verdict = classify(doc);
      counts[verdict] += 1;
      if (verdict === 'ok') {
        console.log(`  ✅ OK       ${doc._id}  "${doc.title}"`);
      } else if (verdict === 'unset') {
        console.log(`  ${DRY_RUN ? '🔎 WOULD  ' : '✏️  UNSET '}  ${doc._id}  "${doc.title}"  content → unset`);
        toUnset.push(doc._id);
      } else {
        console.log(`  ⛔ BLOCKED  ${doc._id}  "${doc.title}"  (content is its ONLY text — no sections)`);
      }
    }
    if (docs.length === 0) console.log('  (no posts)');

    console.log('\n' + '─'.repeat(56));
    console.log(
      `Posts: ${docs.length}   Unset: ${counts.unset}   ` +
      `Already clean: ${counts.ok}   Blocked: ${counts.blocked}`
    );

    // Counted BEFORE any write, so a refusal leaves every row as it was.
    if (counts.blocked > 0) {
      throw new Error(
        `Refusing: ${counts.blocked} post(s) have their text ONLY in \`content\`. ` +
        'Nothing was changed. Convert them to sections first, then run this again.'
      );
    }

    if (!DRY_RUN && toUnset.length > 0) {
      await blogs.updateMany({ _id: { $in: toUnset } }, { $unset: { content: '' } });
    }
    if (DRY_RUN) console.log('\nDRY RUN — no changes were written.');
    console.log('');
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  run().catch((err) => {
    console.error('\n💥 Migration failed:', err.message);
    process.exit(1);
  });
}

module.exports = { run, classify };
