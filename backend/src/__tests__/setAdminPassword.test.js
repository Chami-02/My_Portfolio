// PF-120 — the break-glass password script (`npm run admin:password`).
// Only its core is tested here; the prompt wrapper is a terminal concern.
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

  it('refuses a password shorter than the schema minimum', async () => {
    await User.create({ email: 'admin@test.com', password: OLD });
    await expect(setAdminPassword({ password: 'short' })).rejects.toThrow(/at least 8/);
    const user = await User.findOne({}).select('+password');
    expect(await user.matchPassword(OLD)).toBe(true);
  });

  // Production still runs master's schema: no loginEmails, no googleIdentities.
  // save() also writes the schema's default `loginEmails: []` — measured, and
  // harmless: migration 009 `$set`s loginEmails unconditionally. Pinned exactly,
  // so anything ELSE leaking into a production document fails here.
  it('on a pre-009 document, changes only password and updatedAt (+ the empty loginEmails default and __v)', async () => {
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
    expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
    const changed = Object.keys(after).filter(
      (k) => JSON.stringify(after[k]) !== JSON.stringify(before[k])
    );
    // `__v` too: writing an array path bumps Mongoose's version key (measured).
    expect(changed.sort()).toEqual(['__v', 'password', 'updatedAt']);
  });
});
