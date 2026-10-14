// backend/src/__tests__/010-about-public-email.test.js
//
// Migration 010 — the public address becomes pcgallege@gmail.com (PF-119,
// absorbing PF-122). The case that matters is the SKIP: an address the owner
// set in the panel must survive, and getting it wrong logs `UPDATE` — which
// is what a correct run also says.

const mongoose = require('mongoose');
const { run, OLD_EMAIL, NEW_EMAIL } = require('../migrations/010-about-public-email');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

const runMigration = async (...argv) => {
  const original = process.argv;
  process.argv = ['node', 'script', ...argv];
  try {
    await run();
  } finally {
    process.argv = original;
    await connectTestDB();
  }
};

let logSpy;
beforeAll(connectTestDB);
beforeEach(() => { logSpy = jest.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(async () => {
  logSpy.mockRestore();
  await connectTestDB();
  await clearDB();
});
afterAll(async () => {
  await connectTestDB();
  await disconnectTestDB();
});

const output = () => logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
const abouts = () => mongoose.connection.collection('abouts');
const stored = async () => (await abouts().findOne({})).email;

it('--dry-run SEES the old address and writes nothing', async () => {
  await abouts().insertOne({ email: OLD_EMAIL });
  await runMigration('--dry-run');
  expect(output()).toMatch(/WOULD/);
  expect(await stored()).toBe(OLD_EMAIL);
});

it('a real run replaces the old personal address', async () => {
  await abouts().insertOne({ email: OLD_EMAIL });
  await runMigration();
  expect(await stored()).toBe(NEW_EMAIL);
  expect(output()).toMatch(/Updated: 1/);
});

it('LEAVES A PANEL-SET ADDRESS ALONE and says so', async () => {
  await abouts().insertOne({ email: 'hello@my-domain.dev' });
  await runMigration();
  expect(await stored()).toBe('hello@my-domain.dev');
  expect(output()).toMatch(/Skipped: 1/);
  expect(output()).toMatch(/Updated: 0/);
});

it('is idempotent', async () => {
  await abouts().insertOne({ email: OLD_EMAIL });
  await runMigration();
  logSpy.mockClear();
  await runMigration();
  expect(output()).toMatch(/Already correct: 1/);
  expect(output()).toMatch(/Updated: 0/);
});
