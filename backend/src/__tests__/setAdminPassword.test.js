// PF-120 — the break-glass password script (`npm run admin:password`).
// Only its core is tested here; the prompt wrapper is a terminal concern.
// PF-124: the leak check is mocked — no network from a unit suite.
jest.mock('../services/breachedPasswords', () => ({ isBreached: jest.fn().mockResolvedValue(false) }));
const bcrypt   = require('bcryptjs');
const mongoose = require('mongoose');
const User     = require('../models/User');
const Session  = require('../models/Session');
const { issueSession, isFamilyLive } = require('../services/sessionService');
const { setAdminPassword } = require('../../scripts/set-admin-password');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

beforeAll(connectTestDB);
afterEach(clearDB);
afterAll(disconnectTestDB);

const OLD = 'Old-Password-123';
const NEW = 'A-new-long-password-456';

describe('setAdminPassword (PF-120)', () => {
  it('stores a HASH of the new password — never the plaintext', async () => {
    await User.create({ email: 'admin@test.com', password: OLD });
    await setAdminPassword({ password: NEW });

    const user = await User.findOne({}).select('+password');
    expect(user.password).not.toBe(NEW);
    expect(await user.matchPassword(NEW)).toBe(true);
    expect(await user.matchPassword(OLD)).toBe(false);
  });

  it('signs out every existing session', async () => {
    const user = await User.create({ email: 'admin@test.com', password: OLD });
    const a = await issueSession(user);
    const b = await issueSession(user);
    const familyOf = async (s) => (await Session.findById(s.sessionId)).family;

    await setAdminPassword({ password: NEW });

    expect(await isFamilyLive(await familyOf(a))).toBe(false);
    expect(await isFamilyLive(await familyOf(b))).toBe(false);
  });

  it.each([0, 2])('refuses with %i users and changes nothing', async (count) => {
    for (let i = 0; i < count; i += 1) {
      await User.create({ email: `admin${i}@test.com`, password: OLD });
    }
    await expect(setAdminPassword({ password: NEW })).rejects.toThrow(/exactly one/);
    for (const user of await User.find({}).select('+password')) {
      expect(await user.matchPassword(OLD)).toBe(true);
    }
  });

  // PF-125 — the shared password policy (15+), not the schema's floor of 8.
  it('refuses a password shorter than the policy minimum', async () => {
    await User.create({ email: 'admin@test.com', password: OLD });
    await expect(setAdminPassword({ password: 'fourteen-chars' })).rejects.toThrow(/at least 15/);
    const user = await User.findOne({}).select('+password');
    expect(await user.matchPassword(OLD)).toBe(true);
  });

  // Production still runs master's schema: no loginEmails, no googleIdentities.
  // save() also writes the schema's default `loginEmails: []` — measured, and
  // harmless: migration 009 `$set`s loginEmails unconditionally. PF-124 adds
  // the two password-history fields, on purpose. Pinned exactly, so anything
  // ELSE leaking into a production document fails here.
  it('on a pre-009 document, changes only password, its history and updatedAt (+ loginEmails default and __v)', async () => {
    const users = mongoose.connection.collection('users');
    const createdAt = new Date('2026-01-01T00:00:00Z');
    await users.insertOne({
      email: 'old@test.com', password: await bcrypt.hash(OLD, 4), role: 'admin',
      createdAt, updatedAt: createdAt, __v: 0,
    });
    const before = await users.findOne({});

    await setAdminPassword({ password: NEW });

    const after = await users.findOne({});
    expect(after.loginEmails).toEqual([]);
    delete after.loginEmails;
    // The old hash is kept for the reuse check (PCI DSS: not one of the last 4).
    expect(after.passwordHistory).toEqual([{ hash: before.password, changedAt: createdAt }]);
    expect(after.passwordChangedAt).toBeInstanceOf(Date);
    delete after.passwordHistory;
    delete after.passwordChangedAt;
    expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
    const changed = Object.keys(after).filter(
      (k) => JSON.stringify(after[k]) !== JSON.stringify(before[k])
    );
    // `__v` too: writing an array path bumps Mongoose's version key (measured).
    expect(changed.sort()).toEqual(['__v', 'password', 'updatedAt']);
  });

  // PF-124 — the break-glass door follows every rule the other two do.
  it('refuses a password built from the site name, and changes nothing', async () => {
    await User.create({ email: 'a@test.com', password: OLD });
    await expect(setAdminPassword({ password: 'my portfolio password 1' })).rejects.toThrow(/site's name.*Nothing changed/);
    expect(await (await User.findOne({}).select('+password')).matchPassword(OLD)).toBe(true);
  });

  it('refuses the current password, and changes nothing', async () => {
    await User.create({ email: 'a@test.com', password: NEW });
    await expect(setAdminPassword({ password: NEW })).rejects.toThrow(/used this password recently/);
  });
});
