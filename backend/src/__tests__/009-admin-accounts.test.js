// backend/src/__tests__/009-admin-accounts.test.js
//
// Migration 009 — the one admin gets its two real sign-in addresses (PF-119).
//
// Runs the REAL script against a REAL database (008's rule), and every case
// plants its own starting state: a migration that finds nothing prints what a
// correct one prints. Users are written through the RAW collection, because
// the old shape (no `loginEmails`) is exactly what production holds.

const mongoose = require('mongoose');
const User = require('../models/User');
const { run, PRIMARY_EMAIL, LOGIN_EMAILS } = require('../migrations/009-admin-accounts');
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
const users  = () => mongoose.connection.collection('users');
const plant  = (doc) => users().insertOne({ password: 'hash-stays-put', role: 'admin', ...doc });

it('the pair is the owner\'s (PF-119)', () => {
  expect(PRIMARY_EMAIL).toBe('pcgallege@gmail.com');
  expect(LOGIN_EMAILS).toEqual(['parindrachameekara@gmail.com']);
});

it('--dry-run SEES an old-shape admin and writes nothing', async () => {
  await plant({ email: 'old@example.com' });
  await runMigration('--dry-run');

  expect(output()).toMatch(/WOULD/);
  const [u] = await users().find({}).toArray();
  expect(u.email).toBe('old@example.com');
  expect(u.loginEmails).toBeUndefined();
});

it('a real run sets both addresses, WHATEVER the old one was, and keeps the password', async () => {
  await plant({ email: 'old@example.com' });
  await runMigration();

  const [u] = await users().find({}).toArray();
  expect(u.email).toBe(PRIMARY_EMAIL);
  expect(u.loginEmails).toEqual(LOGIN_EMAILS);
  expect(u.password).toBe('hash-stays-put');
  // …and the model now finds the admin by either address.
  expect(await User.findByLoginEmail('parindrachameekara@gmail.com')).not.toBeNull();
});

it('does not print the old address — it is being retired', async () => {
  await plant({ email: 'old@example.com' });
  await runMigration();
  expect(output()).not.toContain('old@example.com');
});

it('is idempotent — a second run reports it already correct', async () => {
  await plant({ email: 'old@example.com' });
  await runMigration();
  logSpy.mockClear();
  await runMigration();
  expect(output()).toMatch(/✅ OK/);
  expect(output()).not.toMatch(/UPDATE/);
});

it('does nothing on a database with no User', async () => {
  await runMigration();
  expect(output()).toMatch(/no User/);
  expect(await users().countDocuments()).toBe(0);
});

it('REFUSES with two Users — every account is an admin, a human decides', async () => {
  await plant({ email: 'a@example.com' });
  await plant({ email: 'b@example.com' });

  await expect(runMigration()).rejects.toThrow(/Refusing: 2 User documents/);
  const emails = (await users().find({}).toArray()).map((u) => u.email).sort();
  expect(emails).toEqual(['a@example.com', 'b@example.com']);
});
