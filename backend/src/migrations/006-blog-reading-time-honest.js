#!/usr/bin/env node
// backend/src/migrations/006-blog-reading-time-honest.js
//
// PF-103 — Retire the hardcoded reading times; let every post compute its own.
//
// WHY THIS EXISTS. Migration 005 wrote 6 / 7 / 4 / 5 into production on
// 2026-09-02, transcribed from docs/design/Blog.dc.html. Those figures were
// never true of the actual post bodies — measured with the model's own
// 200-wpm formula, the four posts are 158 / 123 / 89 / 64 words and every one
// of them computes to 1 minute. The design assumed full-length posts; the
// seeded ones are short excerpts.
//
// PF-103 removes the literals from seed.js, but seed.js only runs on a fresh
// environment (it deletes every Project, Skill, Blog, About and User first),
// so a live database keeps the fiction until something rewrites it. Same
// shape and same reason as 004 and 005.
//
// ⚠️ 005 IS NOT EDITED. It has run against production and a migration that
// has run is frozen — the next number is how a value gets changed. Reading
// 005 and 006 in order is also the only record of why the numbers moved.
//
// WHAT CHANGES. Per post: `readingTimeOverride` is cleared to null and
// `readingTimeMinutes` is recomputed from the real content. Nothing else —
// `publishedAt`, `slug`, `views`, `sections` and `createdAt` are untouched,
// so 005's dates survive intact.
//
// ⚠️ HOW THE RECOMPUTE HAPPENS, because it is not visible in this file.
// Nothing here calls the word counter. `post.save()` fires Blog.js's
// `pre('validate')`, which since PF-103 derives `readingTimeMinutes`
// unconditionally from `readingTimeOverride ?? countWords(sections)`. That
// is deliberate: a second copy of the formula here would be a second source
// of truth, and it is exactly the drift 005's own header warns about.
//
// ⚠️ CONSEQUENCE: this migration is only correct when run against code that
// has PF-103's model. Run against the older model, `.save()` would leave the
// old figure in place and the script would loop reporting the same update.
// The post-run read-back below is what catches that rather than trusting the
// script's own counters.
//
// UNLIKE 004 AND 005, THIS SCRIPT HAS NO TARGET TABLE. It does not know what
// any post *should* say — it asks the model. So it touches EVERY post rather
// than a list of four titles, and there is no Missing/Extra to report: a post
// written after the seed is just as entitled to an honest reading time.
//
// IDEMPOTENT: a second run finds every value already equal and writes
// nothing. NON-DESTRUCTIVE: no creates, no deletes, no upserts.
//
// ⚠️ A post with a DELIBERATE pin set from the admin panel would be cleared
// by this. At the time of writing no post has one — the field does not exist
// in any database yet, since PF-103 introduces it — which is the only reason
// a blanket clear is safe. Do not re-run this later without checking.
//
// Usage:
//   node src/migrations/006-blog-reading-time-honest.js --dry-run
//   node src/migrations/006-blog-reading-time-honest.js

require('dotenv').config();
const mongoose = require('mongoose');
const Blog = require('../models/Blog');
const { databaseNameFrom } = require('../config/db');

const DRY_RUN = process.argv.includes('--dry-run');

async function run() {
  // Printed unconditionally, dry-run or not. MONGO_URI defaults to
  // portfolio_dev since the 2026-08-31 restructure, so which database is
  // about to be touched is never something to infer from habit.
  const targetDb = databaseNameFrom(process.env.MONGO_URI);

  console.log('');
  console.log(`Target database: ${targetDb ?? '(none — MONGO_URI has no database name)'}`);
  console.log(`Mode:            ${DRY_RUN ? 'DRY RUN — writes nothing' : 'LIVE — will write'}`);
  if (!DRY_RUN && targetDb === 'portfolio_prod') {
    console.log('⚠️  This is a REAL RUN against portfolio_prod.');
  }
  console.log('─'.repeat(56));

  await mongoose.connect(process.env.MONGO_URI);

  const allPosts = await Blog.find({});

  let updated = 0;
  let already = 0;

  for (const post of allPosts) {
    const before = {
      minutes:  post.readingTimeMinutes,
      override: post.readingTimeOverride ?? null,
    };

    // Clear the pin, then let the model derive. `markModified` is not
    // needed — assigning a top-level path is enough for `pre('validate')`,
    // and the derivation runs on every validate regardless since PF-103.
    post.readingTimeOverride = null;

    // ⚠️ `await post.validate()`, NOT `post.validateSync()`. validateSync
    // does not run middleware at all, so `pre('validate')` never fires and
    // `readingTimeMinutes` keeps whatever it already held — measured: a
    // 501-word doc pinned at 99 stayed 99 through validateSync and became 3
    // through validate(). The dry run would have reported every post
    // "already correct" and written nothing on the live run either, while
    // exiting 0. (validateSync is also deprecated in Mongoose 10.)
    await post.validate();                     // fires the hook without writing

    const after = post.readingTimeMinutes;

    if (before.minutes === after && before.override === null) {
      console.log(`  ✅ OK       ${post.title}  (${after} min)`);
      already += 1;
      continue;
    }

    console.log(
      `  ${DRY_RUN ? '🔎 WOULD  ' : '✏️  UPDATE'}  ${post.title}\n` +
        `       readingTimeMinutes  ${before.minutes ?? 'null'} → ${after}\n` +
        `       readingTimeOverride ${before.override ?? 'null'} → null`
    );

    if (!DRY_RUN) await post.save();
    updated += 1;
  }

  console.log('\n' + '─'.repeat(56));
  console.log(`Posts: ${allPosts.length}   Updated: ${updated}   Already correct: ${already}`);
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

module.exports = { run };
