/**
 * PF-119 — one admin, two addresses, one password (owner, 2026-10-12).
 *
 * Password login accepts the primary `email` AND every `loginEmails` entry,
 * and both land on the SAME account. Its own file because `authLimiter`
 * (10 / 15 min) is live under test and auth.test.js already spends most of
 * that budget — a fresh file is a fresh limiter. This file signs in 9 times.
 */
const request = require('supertest');
const app     = require('../app');
const User    = require('../models/User');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

beforeAll(connectTestDB);
afterEach(clearDB);
afterAll(disconnectTestDB);

const PASSWORD = 'TestPass@1234!';
const ADMIN = { email: 'pcgallege@gmail.com', loginEmails: ['parindrachameekara@gmail.com'], password: PASSWORD };

const login = (email, password = PASSWORD) =>
  request(app).post('/api/auth/login').send({ email, password });

describe('password login with either address', () => {
  beforeEach(() => User.create(ADMIN));

  it('signs in with the primary address', async () => {
    const res = await login('pcgallege@gmail.com');
    expect(res.status).toBe(200);
  });

  it('signs in with the second address — as the SAME account, shown by its primary', async () => {
    const a = await login('pcgallege@gmail.com');
    const b = await login('parindrachameekara@gmail.com');
    expect(b.status).toBe(200);
    expect(b.body.data.id).toBe(a.body.data.id);
    expect(b.body.data.email).toBe('pcgallege@gmail.com');
  });

  it('ignores case and surrounding spaces in the typed address — for BOTH addresses', async () => {
    // Mongoose's own lowercase/trim setters do this on the query; the second
    // case proves they also run on each `loginEmails` element.
    expect((await login('  PCGallege@Gmail.COM ')).status).toBe(200);
    expect((await login(' Parindrachameekara@GMAIL.com ')).status).toBe(200);
  });

  it('refuses any other address with the SAME message as a wrong password', async () => {
    const stranger = await login('admin@test.com');
    const wrongPw  = await login('parindrachameekara@gmail.com', 'WrongPassword!');
    expect(stranger.status).toBe(401);
    expect(wrongPw.status).toBe(401);
    // No difference an attacker could use to learn which addresses exist.
    expect(stranger.body.message).toBe(wrongPw.body.message);
  });

  it('400s an email that is not a string — an array is a Mongo operand, not an address', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: ['pcgallege@gmail.com'], password: PASSWORD });
    expect(res.status).toBe(400);
  });
});

describe('the model', () => {
  it('refuses a login address that repeats the primary one', async () => {
    await expect(User.create({ ...ADMIN, loginEmails: ['pcgallege@gmail.com'] }))
      .rejects.toThrow(/cannot repeat the primary/);
  });

  it('stores login addresses lower-cased and trimmed', async () => {
    const u = await User.create({ ...ADMIN, loginEmails: ['  Parindrachameekara@Gmail.com '] });
    expect(u.loginEmails).toEqual(['parindrachameekara@gmail.com']);
  });

  it('never returns googleIdentities unless asked', async () => {
    await User.create({ ...ADMIN, googleIdentities: [{ sub: 's', email: 'pcgallege@gmail.com' }] });
    expect((await User.findOne({}).lean()).googleIdentities).toBeUndefined();
  });
});
