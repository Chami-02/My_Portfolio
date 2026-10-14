#!/usr/bin/env node
// backend/scripts/verify-migrations-idempotent.js
//
// Proves every migration can run TWICE and leave the database identical.
//
// ── WHY THIS IS NOT "just run the runner twice" ─────────────────────────────
// Running `npm run migrate` a second time does nothing, because the tracking
// collection says everything is applied. That tests the RUNNER, not the
// migrations — and idempotency is a property of the migrations themselves.
//
// So this script does the one thing the runner exists to prevent: it wipes the
// tracking rows and makes every migration execute a second time against a
// database they have already been applied to. If any of them is not idempotent,
// the data changes and this fails.
//
// ⚠️ IT IS DESTRUCTIVE BY DESIGN and refuses to run against anything that is
// not obviously a throwaway database. CI points it at a fresh Mongo service.
//
// ── Why idempotency matters enough to test ──────────────────────────────────
// A deploy can be retried. A migration step can time out after it has already
// half-finished and be run again by an operator who cannot tell. Every
// migration in this repo CLAIMS idempotency in its header comment; until now
// nothing checked, and a comment is not a guarantee.

require('dotenv').config();

const { spawn } = require('child_process');
const { join } = require('path');
const { createHash } = require('crypto');
const mongoose = require('mongoose');

const { databaseNameFrom } = require('../src/config/db');

const RUNNER = join(__dirname, '..', 'src', 'migrations', 'run.js');

/** The tracking collection is excluded — it is SUPPOSED to differ. */
const IGNORED = new Set(['migrations']);

/**
 * ⚠️ MONGOOSE BOOKKEEPING, COMPARED SEPARATELY — NOT IGNORED.
 *
 * `005-blog-publish-dates.js` calls `.save()` on all four blog posts every
 * time it runs, even when `publishedAt` is already correct. The DATA it owns is
 * unchanged; only Mongoose's `updatedAt` moves. Measured: 4/4 documents bumped,
 * with every other field byte-identical.
 *
 * ⚠️ 005 IS FROZEN — it has run in production, and the standing rule is never
 * to edit a migration that has. So the script cannot be "fixed", and this check
 * has to account for it rather than fail forever on a known-benign difference.
 *
 * ⚠️ But it is REPORTED, never silently dropped. A check that quietly excluded
 * a field would be the kind of guard that passes while asserting less than
 * anyone thinks. A repeated write of IDENTICAL data is harmless by definition;
 * what must never differ is the data itself, and that is what fails the run.
 */
const BOOKKEEPING = ['updatedAt'];

const withoutBookkeeping = (doc) => {
  const copy = { ...doc };
  BOOKKEEPING.forEach((k) => delete copy[k]);
  return copy;
};

const runRunner = (args = []) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [RUNNER, ...args], {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`runner exited with ${code}`)));
  });

/**
 * A stable fingerprint of every document in the database.
 *
 * ⚠️ Sorted by `_id` before hashing. Mongo does not promise insertion order on
 * a plain `find()`, so an unsorted read would produce a different hash for an
 * identical database and this check would fail at random — the worst kind of
 * CI job, because the first response to a flaky failure is to delete it.
 */
async function fingerprint(db) {
  const collections = (await db.listCollections().toArray())
    .map((c) => c.name)
    .filter((n) => !IGNORED.has(n))
    .sort();

  const per = {};

  for (const name of collections) {
    const docs = await db.collection(name).find({}).sort({ _id: 1 }).toArray();
    per[name] = {
      count: docs.length,
      // The hash that DECIDES pass or fail — bookkeeping stripped.
      hash: createHash('sha256')
        .update(JSON.stringify(docs.map(withoutBookkeeping))).digest('hex'),
      // The hash that only INFORMS, so timestamp churn stays visible.
      hashWithTimestamps: createHash('sha256')
        .update(JSON.stringify(docs)).digest('hex'),
    };
  }

  return per;
}

const allNames = (before, after) =>
  [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();

/** Collections whose DATA changed. These fail the run. */
const dataDiff = (before, after) => allNames(before, after).filter((n) => {
  const b = before[n], a = after[n];
  if (!b || !a) return true;
  return b.count !== a.count || b.hash !== a.hash;
});

/** Collections where only a bookkeeping timestamp moved. Reported, not fatal. */
const timestampOnlyDiff = (before, after) => allNames(before, after).filter((n) => {
  const b = before[n], a = after[n];
  if (!b || !a) return false;
  return b.hash === a.hash && b.hashWithTimestamps !== a.hashWithTimestamps;
});

async function main() {
  const dbName = databaseNameFrom(process.env.MONGO_URI);

  // ⚠️ THE SAFETY GATE. This script deliberately re-runs every migration, so
  // pointing it at a real database would re-execute seven scripts against live
  // data. The name must look like a throwaway, exactly as `run-jest.js` guards
  // `clearDB`.
  // ⚠️ AND NOT `portfolio_test` EITHER. This script SEEDS and MIGRATES whatever
  // it is pointed at, and leaves that data behind. `portfolio_test` is the Jest
  // suite's database — leftover seed documents there surface later as a fixture
  // "receiving" four extra blog posts, i.e. the isolation-residue shape of a red
  // backend suite, on a diff that never touched the backend. Measured: it broke
  // `blog.query.test.js`'s ordering test exactly that way. CI uses
  // `portfolio_ci`, which is nobody else's.
  if (dbName === 'portfolio_test') {
    console.error('');
    console.error('✖ Refusing to run against portfolio_test.');
    console.error('  This script leaves seeded data behind, and that database');
    console.error('  belongs to the Jest suite — the residue shows up later as');
    console.error('  a random-looking test failure. Use portfolio_ci.');
    process.exit(1);
  }

  if (!dbName || !/test|ci|e2e|tmp/i.test(dbName)) {
    console.error('');
    console.error(`✖ Refusing to run against "${dbName ?? '(no database name)'}".`);
    console.error('  This script RE-RUNS every migration and is destructive.');
    console.error('  Point MONGO_URI at a database whose name contains test/ci/e2e/tmp.');
    process.exit(1);
  }

  console.log('');
  console.log(`Target database: ${dbName}`);
  console.log('Checking every migration is safe to run twice.');
  console.log('─'.repeat(64));

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  try {
    console.log('\n━━ PASS 1 ━━');
    await runRunner([]);
    const before = await fingerprint(db);

    // Make them all pending again. This is the step that forces a genuine
    // second execution rather than a no-op.
    await db.collection('migrations').deleteMany({});

    console.log('\n━━ PASS 2 (same migrations, same database) ━━');
    await runRunner([]);
    const after = await fingerprint(db);

    const changed  = dataDiff(before, after);
    const churned  = timestampOnlyDiff(before, after);

    console.log('\n' + '─'.repeat(64));

    if (churned.length) {
      // Visible, so nobody has to rediscover it — but not a failure.
      console.log('ℹ️  Bookkeeping timestamps moved (data unchanged) in: ' +
                  churned.join(', '));
      console.log('   Known cause: 005-blog-publish-dates.js saves every post');
      console.log('   unconditionally. 005 has run in production and is frozen.');
    }

    if (changed.length === 0) {
      const total = Object.values(before).reduce((n, c) => n + c.count, 0);
      console.log(`✅ Idempotent. ${Object.keys(before).length} collections, ` +
                  `${total} documents, data identical after a second run.`);
      return;
    }

    console.error('✖ NOT IDEMPOTENT — the DATA in these collections changed:');
    changed.forEach((name) => {
      console.error(`\n  ${name}`);
      console.error(`    before: ${JSON.stringify(before[name] ?? null)}`);
      console.error(`    after:  ${JSON.stringify(after[name] ?? null)}`);
    });
    console.error('');
    console.error('  A migration that is not safe to run twice cannot be retried,');
    console.error('  and a deploy step that times out half-way WILL be retried.');
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error('\n💥 Idempotency check failed to complete:', err.message);
  process.exit(1);
});
