#!/usr/bin/env node
// backend/src/migrations/005-blog-publish-dates.js
//
// PF-95 — Backfill `publishedAt` and `readingTimeMinutes` on the seeded
// blog posts.
//
// WHY THIS EXISTS. PF-95 sets both fields explicitly in seed.js, but
// seed.js only runs on a fresh environment — it deletes every Project,
// Skill, Blog, About and User before it writes, so re-running it against a
// live database to pick up a data change is not an option. Without this
// script the live teaser keeps reading `AUG 2026 · 1 MIN READ` on all four
// posts no matter what seed.js says. Same shape as 004.
//
// WHAT CHANGES. Only `publishedAt` and `readingTimeMinutes`, only on posts
// matched by exact `title`. No document is created, deleted, or otherwise
// modified. Targets, transcribed from docs/design/Blog.dc.html's own POSTS
// array (lines 265-316):
//
//   Building a Production-Style MERN Portfolio         JUL 2026   6 MIN
//   Developing ClearDrive.lk with FastAPI and Docker   JUN 2026   7 MIN
//   Getting Started with Docker Compose                MAY 2026   4 MIN
//   Building REST APIs with Java and JAX-RS            APR 2026   5 MIN
//
// Day-of-month and time-of-day are arbitrary; only month and year are
// asserted anywhere.
//
// IDEMPOTENT: sets absolute values, so running it twice is a no-op.
// NON-DESTRUCTIVE: no deletes, no upserts. A title not present in the
// database is reported as Missing and skipped, never created. A post not
// in the target table is reported as Extra and left completely alone.
//
// ── WHY .save() AND NOT 004's updateOne() ──────────────────────────────
// 004 uses `updateOne` deliberately, so a full save cannot re-run
// validators over fields it has no opinion about. That reasoning is sound
// and this file departs from it on purpose, for a reason 004 did not have:
//
// `save()` routes through Blog.js's `pre('validate')` hook — the very hook
// PF-95 changed. Because this script touches neither `content` nor
// `sections`, `contentChanged` is false, so the hook must leave the
// explicit `readingTimeMinutes` alone. If the PF-95 fix were wrong, save()
// would rewrite it back to a computed value and this migration would
// report `Updated: 4` on every re-run instead of settling to
// `Already correct: 4` — a loud, detectable symptom. `updateOne` runs no
// document middleware at all, so it would mask a broken fix rather than
// expose one.
//
// ⚠️ Note this is NOT the reason the PF-95 ticket gives ("pre('validate')
// needs to see readingTimeMinutes as modified so it does NOT recompute").
// That is inverted: `updateOne` would not recompute either, because it
// runs no middleware whatsoever. The recompute is gated on `contentChanged`,
// which is false on this path regardless of which write method is used.
//
// The accepted cost is 004's stated one: a live post that is invalid for
// some unrelated reason will fail this migration loudly rather than being
// quietly patched. That is the better failure mode for a script whose whole
// job is to make production match a known-good table.
// ───────────────────────────────────────────────────────────────────────
//
// Usage:
//   node src/migrations/005-blog-publish-dates.js --dry-run
//   node src/migrations/005-blog-publish-dates.js

require('dotenv').config();
const mongoose = require('mongoose');
const Blog = require('../models/Blog');
const { databaseNameFrom } = require('../config/db');

const DRY_RUN = process.argv.includes('--dry-run');

/**
 * The target values, keyed by the exact `title` in seed.js.
 *
 * `005-blog-publish-dates.test.js` pins seed.js's own literals to this
 * table by parsing seed.js as TEXT — it cannot be `require`d, because it
 * calls `seed()` at module scope and would wipe collections on import.
 * Same approach as 004's test, and the same real duplication: the values
 * live in two files and would otherwise drift silently, each reading fine
 * alone with the only symptom being a fresh environment disagreeing with
 * production.
 */
const TARGET_DATA = {
  'Building a Production-Style MERN Portfolio': {
    publishedAt: new Date('2026-07-14T09:00:00.000Z'),
    readingTimeMinutes: 6,
  },
  'Developing ClearDrive.lk with FastAPI and Docker': {
    publishedAt: new Date('2026-06-09T09:00:00.000Z'),
    readingTimeMinutes: 7,
  },
  'Getting Started with Docker Compose': {
    publishedAt: new Date('2026-05-04T09:00:00.000Z'),
    readingTimeMinutes: 4,
  },
  'Building REST APIs with Java and JAX-RS': {
    publishedAt: new Date('2026-04-02T09:00:00.000Z'),
    readingTimeMinutes: 5,
  },
};

async function run() {
  // ── NEW RELATIVE TO 004 ─────────────────────────────────────────────
  // As of the 2026-08-31 database restructure, MONGO_URI defaults to
  // `portfolio_dev`, not production. When 004 was written, `backend/.env`
  // pointed at the real production database (then literally named `test`),
  // so "run the migration" and "write to production" were the same act by
  // default. The risk INVERTED rather than disappearing: a script copied
  // from 004's pattern now silently targets dev when someone means prod.
  //
  // Printed unconditionally, dry-run or not, so which database is about to
  // be touched is never something to infer from habit.
  // ────────────────────────────────────────────────────────────────────
  const targetDb = databaseNameFrom(process.env.MONGO_URI);

  console.log('');
  console.log(`Target database: ${targetDb ?? '(none — MONGO_URI has no database name)'}`);
  console.log(`Mode:            ${DRY_RUN ? 'DRY RUN — writes nothing' : 'LIVE — will write'}`);
  if (!DRY_RUN && targetDb === 'portfolio_prod') {
    console.log('⚠️  This is a REAL RUN against portfolio_prod.');
  }
  console.log('─'.repeat(56));

  await mongoose.connect(process.env.MONGO_URI);

  const knownTitles = new Set(Object.keys(TARGET_DATA));
  const allPosts = await Blog.find({});

  let updated = 0;
  let already = 0;
  const extras = [];
  const foundTitles = new Set();

  for (const post of allPosts) {
    if (!knownTitles.has(post.title)) {
      extras.push(post.title);
      continue;
    }

    foundTitles.add(post.title);
    const target = TARGET_DATA[post.title];

    const dateMatches =
      post.publishedAt instanceof Date &&
      post.publishedAt.getTime() === target.publishedAt.getTime();
    const readMatches = post.readingTimeMinutes === target.readingTimeMinutes;

    if (dateMatches && readMatches) {
      console.log(`  ✅ OK       ${post.title}`);
      already += 1;
      continue;
    }

    console.log(
      `  ${DRY_RUN ? '🔎 WOULD  ' : '✏️  UPDATE'}  ${post.title}\n` +
        `       publishedAt        ${post.publishedAt ?? 'null'} → ${target.publishedAt.toISOString()}\n` +
        `       readingTimeMinutes ${post.readingTimeMinutes ?? 'null'} → ${target.readingTimeMinutes}`
    );

    if (!DRY_RUN) {
      post.publishedAt = target.publishedAt;
      post.readingTimeMinutes = target.readingTimeMinutes;
      await post.save();
    }
    updated += 1;
  }

  const missing = [...knownTitles].filter((t) => !foundTitles.has(t));

  if (missing.length) {
    console.log('\n  Titles in the target table with no matching post — skipped, never created:');
    missing.forEach((t) => console.log(`     ${t}`));
  }
  if (extras.length) {
    console.log('\n  Posts outside the target table — left untouched:');
    extras.forEach((t) => console.log(`     ${t}`));
  }

  console.log('\n' + '─'.repeat(56));
  console.log(
    `Updated: ${updated}   Already correct: ${already}   ` +
      `Missing: ${missing.length}   Extra: ${extras.length}`
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

module.exports = { run, TARGET_DATA };
