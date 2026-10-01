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

/**
 * Run the real runner, capturing its output. Never inherits stdio.
 *
 * `envOverride` is merged over `process.env` so a test can hand the child a
 * deliberately broken MONGO_URI without disturbing this process's own
 * connection — which `afterEach` still needs in order to clear the database.
 */
const runRunner = (args = [], envOverride = {}) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [RUNNER, ...args], {
      env: { ...process.env, ...envOverride },
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

describe('⚠️ the database-name guard — refuses to start, before connecting', () => {
  /*
   * `mongodb+srv://u:p@host` and `…/host/?retryWrites=true` are both VALID
   * connection strings that name no database, and the driver answers them by
   * silently using one called `test`. Every migration then reports clean work
   * against an empty database and the plan an approver reads describes
   * nothing — which is the single worst output this runner can produce,
   * because it is indistinguishable from "production is already up to date".
   *
   * `assertExplicitDatabase` has existed in config/db.js since PF-66 and was
   * exported all along; the runner simply never called it.
   */
  const NO_DB = 'mongodb+srv://u:p@cluster.mongodb.net';
  const EMPTY_PATH = 'mongodb+srv://u:p@cluster.mongodb.net/?retryWrites=true';

  it.each([
    // ⚠️ A [label, args] table, not a bare args list: `it.each([[]])` has
    // no argument to interpolate, so the APPLY case's name would render as
    // the literal "mode %p" and the one mode with the most to lose would be
    // the one nobody could identify in a failure report.
    ['--status',      ['--status']],
    ['--dry-run',     ['--dry-run']],
    ['--baseline',    ['--baseline']],
    ['(bare: APPLY)', []],
  ])('mode %s exits 1 and names the real problem', async (_label, args) => {
    const { code, out } = await runRunner(args, { MONGO_URI: NO_DB });

    expect(code).toBe(1);

    /*
     * ⚠️ DO NOT ASSERT /has no database name/ HERE. IT IS VACUOUS.
     *
     * Measured: with the guard call deleted, all of these tests still passed.
     * `banner()` prints `Target database: (none — MONGO_URI has no database
     * name)` from run.js's own fallback, so that phrase is in the output
     * whether or not the guard exists — the assertion matched the prose
     * DESCRIBING the condition, not the behaviour RESPONDING to it. The exit
     * code is 1 either way too, because connect() then dies on DNS.
     *
     * These two lines are the only discriminator. The sentence below appears
     * ONLY in the thrown error, never in the banner …
     */
    expect(out).toMatch(/The driver would silently connect to a database called "test"/);

    /*
     * … and this proves connect() was never reached: without the guard the
     * run dies with `querySrv ENOTFOUND _mongodb._tcp.…` instead.
     *
     * ⚠️ /Mongo/i cannot be used for this — it matches the guard's own
     * message, which begins "MONGO_URI".
     */
    expect(out).not.toMatch(/querySrv|ENOTFOUND|ServerSelection|ECONNREFUSED/);
  }, 30000);

  it('rejects an empty path the same way as a missing one', async () => {
    const { code, out } = await runRunner(['--status'], { MONGO_URI: EMPTY_PATH });

    expect(code).toBe(1);
    expect(out).toMatch(/The driver would silently connect to a database called "test"/);
    expect(out).not.toMatch(/querySrv|ENOTFOUND|ServerSelection|ECONNREFUSED/);
  }, 30000);

  it('still prints the banner first, so the throw explains what was read', async () => {
    // The operator sees `Target database: (none — …)` and then the reason.
    // Reversed, the error arrives with nothing to attach it to.
    const { out } = await runRunner(['--status'], { MONGO_URI: NO_DB });

    expect(out).toMatch(/Target database: \(none/);
    expect(out.indexOf('Target database:'))
      .toBeLessThan(out.indexOf('The driver would silently connect'));
  }, 30000);

  it('CONTROL: a URI that names a database gets past the guard', async () => {
    // ⚠️ Without this, a guard that refused EVERY uri would pass all of
    // the above. This is the case that must still work.
    const { code, out } = await runRunner(['--status']);

    expect(code).toBe(0);
    expect(out).not.toMatch(/The driver would silently connect/);
    expect(out).toMatch(/Applied \(/);
  }, 30000);
});
