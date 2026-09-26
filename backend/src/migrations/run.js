#!/usr/bin/env node
// backend/src/migrations/run.js
//
// The migration runner — applies whatever this database has not seen yet.
//
// ── WHAT IT REPLACES ────────────────────────────────────────────────────────
// Running each migration by hand, in the right order, and remembering which
// databases had already had which. The scripts themselves do not change; what
// changes is that the DATABASE now records what has been applied to it.
//
//   npm run migrate            apply every pending migration, in order
//   npm run migrate:status     list applied and pending, change nothing
//   npm run migrate:dry        --dry-run every pending migration
//   npm run migrate:baseline   record pending ones as applied WITHOUT running
//
// ⚠️ Every mode prints the TARGET DATABASE NAME first and never the connection
// string. `MONGO_URI` carries a password.
//
// ── ⚠️ WHY THIS SPAWNS CHILD PROCESSES INSTEAD OF import + run() ────────────
// The obvious design — `require()` each migration and call its exported
// `run()` — CANNOT work in this repo, and would fail silently and
// destructively:
//
//   • 003, 004, 005 and 006 capture the dry-run flag at MODULE SCOPE
//     (`const DRY_RUN = process.argv.includes('--dry-run')`). That is evaluated
//     when the file is first `require`d, against whatever argv the RUNNER was
//     started with. A runner that imports them and then "passes" --dry-run
//     some other way would have those four WRITE during a dry run.
//   • 001 exports no `run()` at all.
//
// Spawning `node src/migrations/NNN-*.js [--dry-run]` is exactly what a person
// does at the terminal, so every script keeps the argv contract it was written
// against. It also means NONE of them had to be edited — which matters,
// because 005 has run in production and is frozen, and editing an applied
// migration is the specific thing the checksum guard below exists to prevent.
//
// Side benefit: a migration that crashes takes down its own process, not the
// runner, so the runner can record exactly how far it got.

require('dotenv').config();

const { readdirSync, readFileSync } = require('fs');
const { createHash } = require('crypto');
const { join } = require('path');
const { spawn } = require('child_process');
const mongoose = require('mongoose');

const Migration = require('../models/Migration');
const { databaseNameFrom } = require('../config/db');

const DIR = __dirname;

/**
 * ⚠️ `run.js` itself must never match, or the runner would try to run itself
 * forever. Anchoring on `NNN-` does that for free and also ignores README.md,
 * editor backups and anything else that lands in this directory.
 */
const MIGRATION_FILE = /^\d{3}-.+\.js$/;

/**
 * Every migration on disk, in the order they must be applied.
 *
 * ⚠️ A plain lexicographic sort is CORRECT here, and only because the numbers
 * are zero-padded to three digits. `010` would sort before `9` if they were
 * not — the classic ordering bug. The regex above enforces the padding, so the
 * two facts cannot drift apart.
 */
const discover = () => readdirSync(DIR).filter((f) => MIGRATION_FILE.test(f)).sort();

const checksumOf = (file) =>
  createHash('sha256').update(readFileSync(join(DIR, file))).digest('hex');

/** Run one migration as its own process, inheriting stdio so its log is live. */
const spawnMigration = (file, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(DIR, file), ...args], {
      stdio: 'inherit',
      env:   process.env,
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) return resolve();
      reject(new Error(
        signal ? `${file} was killed by ${signal}` : `${file} exited with code ${code}`
      ));
    });
  });

const banner = (mode) => {
  const db = databaseNameFrom(process.env.MONGO_URI);
  console.log('');
  console.log(`Target database: ${db ?? '(none — MONGO_URI has no database name)'}`);
  console.log(`Mode:            ${mode}`);
  if (db === 'portfolio_prod' && mode === 'APPLY') {
    console.log('⚠️  This is a REAL RUN against portfolio_prod.');
  }
  console.log('─'.repeat(64));
  return db;
};

/**
 * Compare the files on disk against what this database says it has applied.
 *
 * Returns `{ applied, pending, changed, missing }`.
 */
async function inspect() {
  const onDisk  = discover();
  const records = await Migration.find({}).sort({ name: 1 }).lean();
  const byName  = new Map(records.map((r) => [r.name, r]));

  const applied = [];
  const pending = [];
  const changed = [];

  for (const file of onDisk) {
    const record = byName.get(file);
    if (!record) { pending.push(file); continue; }

    applied.push(record);
    if (record.checksum !== checksumOf(file)) changed.push(file);
  }

  /**
   * ⚠️ A migration the DATABASE has applied but which is no longer on disk.
   * This is not tidiness — it means someone deleted or renamed an applied
   * migration, so the repo no longer describes how this database got into its
   * current shape. Reported loudly; it is never normal.
   */
  const missing = records.filter((r) => !onDisk.includes(r.name)).map((r) => r.name);

  return { onDisk, applied, pending, changed, missing };
}

/**
 * ⚠️ THE GUARD THAT MAKES "never edit an applied migration" REAL.
 *
 * If a recorded file's contents no longer hash to what was stored, the
 * database and the script disagree about what was done to it — and every later
 * migration was written assuming the earlier one did what it says. There is no
 * safe automatic recovery, so the runner refuses to do anything at all.
 */
function assertUnchanged({ changed, missing }) {
  if (changed.length === 0 && missing.length === 0) return;

  console.error('');
  console.error('✖ REFUSING TO RUN — the migration history does not match this database.');

  if (changed.length) {
    console.error('');
    console.error('  These have been EDITED since they were applied here:');
    changed.forEach((f) => console.error(`    • ${f}`));
    console.error('');
    console.error('  An applied migration is a record of what happened, not code to');
    console.error('  maintain. Revert the edit, or write the NEXT number instead.');
  }

  if (missing.length) {
    console.error('');
    console.error('  These were applied here but are GONE from the repo:');
    missing.forEach((f) => console.error(`    • ${f}`));
    console.error('');
    console.error('  Restore them — the repo no longer explains this database.');
  }

  console.error('');
  process.exitCode = 1;
  throw new Error('migration history mismatch');
}

const printList = ({ applied, pending }) => {
  console.log(`\nApplied (${applied.length}):`);
  if (!applied.length) console.log('  (none — this database has never been migrated)');
  applied.forEach((r) => {
    const when = r.appliedAt ? new Date(r.appliedAt).toISOString().slice(0, 16).replace('T', ' ') : '?';
    console.log(`  ✅ ${r.name}${r.baseline ? '   [baselined, not executed]' : `   ${when}`}`);
  });

  console.log(`\nPending (${pending.length}):`);
  if (!pending.length) console.log('  (none — up to date)');
  pending.forEach((f) => console.log(`  ⏳ ${f}`));
};

async function main() {
  const argv    = process.argv.slice(2);
  const status  = argv.includes('--status');
  const dryRun  = argv.includes('--dry-run');
  const baseline = argv.includes('--baseline');

  const mode = status ? 'STATUS — reads only'
    : baseline ? 'BASELINE — records as applied WITHOUT running'
    : dryRun ? 'DRY RUN — writes nothing'
    : 'APPLY';

  banner(mode);

  await mongoose.connect(process.env.MONGO_URI);

  try {
    const state = await inspect();
    assertUnchanged(state);
    printList(state);

    if (status) return;

    if (state.pending.length === 0) {
      console.log('\n' + '─'.repeat(64));
      console.log('Nothing to do.\n');
      return;
    }

    console.log('\n' + '─'.repeat(64));

    for (const file of state.pending) {
      if (baseline) {
        // ⚠️ Records without executing. Only correct for a database that
        // already had these applied by hand — which is why it is a separate,
        // explicitly-named mode rather than a flag on the normal path.
        console.log(`\n📌 BASELINE  ${file}  (recording as applied, NOT running)`);
        await Migration.create({
          name: file, checksum: checksumOf(file), durationMs: 0, baseline: true,
        });
        continue;
      }

      console.log(`\n▶  ${file}`);
      const startedAt = Date.now();
      await spawnMigration(file, dryRun ? ['--dry-run'] : []);
      const durationMs = Date.now() - startedAt;

      if (dryRun) {
        console.log(`   (dry run — not recorded)`);
        continue;
      }

      // ⚠️ RECORDED ONLY AFTER THE CHILD EXITS 0. A migration that crashes
      // halfway is NOT recorded, so the next run retries it — which is safe
      // precisely because every migration in this repo is idempotent. Writing
      // the row first would strand a half-applied migration as "done".
      await Migration.create({ name: file, checksum: checksumOf(file), durationMs });
      console.log(`   ✅ applied in ${durationMs}ms`);
    }

    console.log('\n' + '─'.repeat(64));
    console.log(
      baseline ? `Baselined: ${state.pending.length}`
        : dryRun ? `Would apply: ${state.pending.length} (nothing was written)`
        : `Applied: ${state.pending.length}`
    );
    console.log('');
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    // The history-mismatch path has already printed its own explanation.
    if (err.message !== 'migration history mismatch') {
      console.error('\n💥 Migration run failed:', err.message);
    }
    process.exit(1);
  });
}

module.exports = { discover, checksumOf, inspect, assertUnchanged, MIGRATION_FILE };
