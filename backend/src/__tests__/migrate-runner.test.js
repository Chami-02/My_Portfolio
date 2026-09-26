// backend/src/__tests__/migrate-runner.test.js
//
// The migration runner — `src/migrations/run.js`.
//
// ⚠️ THE INTEGRATION CASES SPAWN THE REAL RUNNER as a child process, rather
// than importing `main()`. That is deliberate and mirrors what the runner does
// to the migrations themselves: the whole design rests on argv reaching a fresh
// process, and a test that imported the module would prove nothing about the
// path anybody actually uses.
//
// The child inherits `process.env`, and `scripts/run-jest.js` has already
// rewritten `MONGO_URI` to `portfolio_test`, so every write below lands in the
// test database. That rewrite is the only thing making this safe — never run
// this file through `npx jest`.

const { spawn } = require('child_process');
const { join } = require('path');
const { writeFileSync, unlinkSync, existsSync } = require('fs');
const mongoose = require('mongoose');

const Migration = require('../models/Migration');
const {
  discover, checksumOf, inspect, assertUnchanged, MIGRATION_FILE,
} = require('../migrations/run');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');
const RUNNER = join(MIGRATIONS_DIR, 'run.js');

/** Run the real runner, capturing its output. Never inherits stdio. */
const runRunner = (args = []) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [RUNNER, ...args], {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('exit', (code) => resolve({ code, out }));
  });

beforeAll(connectTestDB);
afterEach(async () => {
  await connectTestDB();
  await clearDB();
});
afterAll(async () => {
  await connectTestDB();
  await disconnectTestDB();
});

describe('discover', () => {
  it('finds the numbered migrations and nothing else', () => {
    const files = discover();

    expect(files.length).toBeGreaterThan(0);
    files.forEach((f) => expect(f).toMatch(MIGRATION_FILE));
  });

  it('⚠️ never includes run.js itself', () => {
    // A runner that discovered itself would spawn itself forever.
    expect(discover()).not.toContain('run.js');
  });

  it('returns them in applicable order', () => {
    const files = discover();
    expect([...files].sort()).toEqual(files);

    // ⚠️ The lexicographic sort is only correct BECAUSE the numbers are
    // zero-padded to three digits — `010` would otherwise sort before `9`.
    // The regex is what keeps that true, so it is asserted rather than assumed.
    files.forEach((f) => expect(f.slice(0, 3)).toMatch(/^\d{3}$/));
  });

  it('tolerates the gap at 002', () => {
    // 002 has never existed. Ordering must not depend on numbers being dense.
    const numbers = discover().map((f) => f.slice(0, 3));
    expect(numbers).toContain('001');
    expect(numbers).toContain('003');
    expect(numbers).not.toContain('002');
  });
});

describe('checksumOf', () => {
  it('is stable for unchanged content', () => {
    const file = discover()[0];
    expect(checksumOf(file)).toBe(checksumOf(file));
    expect(checksumOf(file)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('differs between two different migrations', () => {
    const [a, b] = discover();
    expect(checksumOf(a)).not.toBe(checksumOf(b));
  });
});

describe('inspect', () => {
  it('reports everything pending on an untouched database', async () => {
    const { applied, pending } = await inspect();

    expect(applied).toEqual([]);
    expect(pending).toEqual(discover());
  });

  it('moves a recorded migration from pending to applied', async () => {
    const file = discover()[0];
    await Migration.create({ name: file, checksum: checksumOf(file) });

    const { applied, pending } = await inspect();

    expect(applied.map((r) => r.name)).toEqual([file]);
    expect(pending).not.toContain(file);
  });

  it('flags an applied migration whose file has since changed', async () => {
    const file = discover()[0];
    await Migration.create({ name: file, checksum: 'a'.repeat(64) });

    const { changed } = await inspect();

    expect(changed).toEqual([file]);
  });

  it('flags a recorded migration that is no longer on disk', async () => {
    await Migration.create({ name: '999-deleted.js', checksum: 'b'.repeat(64) });

    const { missing } = await inspect();

    expect(missing).toEqual(['999-deleted.js']);
  });
});

describe('assertUnchanged — the "never edit an applied migration" guard', () => {
  it('passes when history matches', () => {
    expect(() => assertUnchanged({ changed: [], missing: [] })).not.toThrow();
  });

  it('throws when an applied migration was edited', () => {
    expect(() => assertUnchanged({ changed: ['005-x.js'], missing: [] }))
      .toThrow(/history mismatch/i);
  });

  it('throws when an applied migration was deleted', () => {
    expect(() => assertUnchanged({ changed: [], missing: ['005-x.js'] }))
      .toThrow(/history mismatch/i);
  });
});

describe('the runner end to end', () => {
  it('--status reports without changing anything', async () => {
    const { code, out } = await runRunner(['--status']);

    expect(code).toBe(0);
    expect(out).toMatch(/STATUS — reads only/);
    expect(out).toMatch(/never been migrated/);
    await expect(Migration.countDocuments()).resolves.toBe(0);
  }, 30000);

  it('⚠️ never prints the connection string, only the database name', async () => {
    // MONGO_URI carries a password. The banner prints `databaseNameFrom(...)`
    // precisely so an operator can confirm the target without the secret
    // appearing in a terminal, a CI log or a screenshot.
    const { out } = await runRunner(['--status']);

    expect(out).toMatch(/Target database: \w+/);
    expect(out).not.toContain(process.env.MONGO_URI);
    expect(out).not.toMatch(/mongodb(\+srv)?:\/\//);
  }, 30000);

  it('--baseline records every migration WITHOUT running it', async () => {
    const { code, out } = await runRunner(['--baseline']);

    expect(code).toBe(0);
    expect(out).toMatch(/BASELINE — records as applied WITHOUT running/);

    const rows = await Migration.find({}).lean();
    expect(rows.map((r) => r.name).sort()).toEqual(discover());
    // The flag is the evidence that these were NOT executed.
    expect(rows.every((r) => r.baseline === true)).toBe(true);
    expect(rows.every((r) => r.durationMs === 0)).toBe(true);
  }, 60000);

  it('does nothing on a second run once everything is applied', async () => {
    await runRunner(['--baseline']);
    const { code, out } = await runRunner([]);

    expect(code).toBe(0);
    expect(out).toMatch(/Nothing to do/);
  }, 60000);

  it('⚠️ REFUSES to run when an applied migration has been edited', async () => {
    const file = discover()[0];
    await Migration.create({ name: file, checksum: 'c'.repeat(64) });

    const { code, out } = await runRunner([]);

    expect(code).toBe(1);
    expect(out).toMatch(/REFUSING TO RUN/);
    expect(out).toMatch(/EDITED since they were applied/);
    expect(out).toContain(file);
    // And it refused BEFORE applying anything else.
    await expect(Migration.countDocuments()).resolves.toBe(1);
  }, 30000);

  it('⚠️ REFUSES when a recorded migration has vanished from the repo', async () => {
    await Migration.create({ name: '999-deleted.js', checksum: 'd'.repeat(64) });

    const { code, out } = await runRunner([]);

    expect(code).toBe(1);
    expect(out).toMatch(/GONE from the repo/);
  }, 30000);

  it('applies pending migrations for real and records each one', async () => {
    // The full path: spawn each child, wait for exit 0, write the row.
    const { code, out } = await runRunner([]);

    expect(code).toBe(0);
    expect(out).toMatch(/Applied: \d+/);

    const rows = await Migration.find({}).lean();
    expect(rows.map((r) => r.name).sort()).toEqual(discover());

    // ⚠️ Real runs are distinguishable from baselined ones. "we ran this" and
    // "we assumed this had run" are different claims and only one is evidence.
    expect(rows.every((r) => r.baseline === false)).toBe(true);
    expect(rows.some((r) => r.durationMs > 0)).toBe(true);
  }, 180000);

  it('⚠️ a dry run writes NOTHING — not even the tracking rows', async () => {
    /*
     * THE CASE THE WHOLE SPAWN DESIGN EXISTS FOR.
     *
     * Migrations 003, 004, 005 and 006 read `--dry-run` at MODULE SCOPE, so an
     * importing runner would evaluate that against its OWN argv at require
     * time and those four would WRITE during a dry run. Spawning gives each
     * child its own argv, which is the only thing that makes this pass.
     */
    const { code, out } = await runRunner(['--dry-run']);

    expect(code).toBe(0);
    expect(out).toMatch(/Would apply: \d+ \(nothing was written\)/);
    expect(out).toMatch(/not recorded/);

    await expect(Migration.countDocuments()).resolves.toBe(0);
  }, 180000);
});
