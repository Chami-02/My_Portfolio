/**
 * PF-119 follow-up (owner, 2026-10-13) — the panel names the address you
 * signed in WITH, not the account's primary.
 *
 * `/auth/me` keeps `email` = the primary and adds `signedInAs` = the address
 * this login used, carried across every refresh. Its own file because
 * `authLimiter` (10 / 15 min) is live under test — this file signs in 5 times.
 * The Google door's half lives in google.auth.test.js.
 */
const request = require('supertest');
const app     = require('../app');
const User    = require('../models/User');
const { issueSession } = require('../services/sessionService');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

beforeAll(connectTestDB);
afterEach(clearDB);
afterAll(disconnectTestDB);

const PASSWORD = 'TestPass@1234!';
const PRIMARY  = 'pcgallege@gmail.com';
const SECOND   = 'parindrachameekara@gmail.com';

let user;
beforeEach(async () => {
  user = await User.create({ email: PRIMARY, loginEmails: [SECOND], password: PASSWORD });
});

const login = (email) =>
  request(app).post('/api/auth/login').send({ email, password: PASSWORD });

const me = (accessToken) =>
  request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`);

const meAfterLogin = async (email) => {
  const res = await login(email);
  expect(res.status).toBe(200);
  return (await me(res.body.accessToken)).body.data;
};

describe('GET /api/auth/me — signedInAs', () => {
  it('names the primary address when it was used', async () => {
    const data = await meAfterLogin(PRIMARY);
    expect(data.signedInAs).toBe(PRIMARY);
    expect(data.email).toBe(PRIMARY);
  });

  it('names the second address when IT was used — while email stays the primary', async () => {
    const data = await meAfterLogin(SECOND);
    expect(data.signedInAs).toBe(SECOND);
    expect(data.email).toBe(PRIMARY);
  });

  it('names the STORED spelling, not what was typed', async () => {
    const data = await meAfterLogin('  Parindrachameekara@GMAIL.com ');
    expect(data.signedInAs).toBe(SECOND);
  });

  it('keeps naming the same address after a refresh rotates the session', async () => {
    const first = await login(SECOND);
    const next  = await request(app).post('/api/auth/refresh')
      .send({ refreshToken: first.body.refreshToken });
    expect(next.status).toBe(200);
    expect((await me(next.body.accessToken)).body.data.signedInAs).toBe(SECOND);
  });

  it('falls back to the primary for a session that recorded no address (issued before this existed)', async () => {
    const session = await issueSession(user);
    expect((await me(session.accessToken)).body.data.signedInAs).toBe(PRIMARY);
  });

  it('falls back to the primary once the recorded address is no longer one of the account\'s', async () => {
    const session = await issueSession(user, undefined, SECOND);
    await User.updateOne({ _id: user._id }, { $set: { loginEmails: [] } });
    expect((await me(session.accessToken)).body.data.signedInAs).toBe(PRIMARY);
  });
});

/*
 * PF-131 — the Settings panel's Account card. Every address that signs in,
 * which one is primary, and whether Google is bound to it. Sessions are minted
 * with issueSession, so none of these spend the authLimiter's budget.
 */
describe('GET /api/auth/me — addresses', () => {
  const addressesOf = async () => {
    const session = await issueSession(user);
    return (await me(session.accessToken)).body.data.addresses;
  };

  it('lists the primary first, then every login address — none Google-bound yet', async () => {
    expect(await addressesOf()).toEqual([
      { address: PRIMARY, primary: true,  google: false },
      { address: SECOND,  primary: false, google: false },
    ]);
  });

  it('flags Google only on the address that has a bound account', async () => {
    await User.updateOne({ _id: user._id },
      { $set: { googleIdentities: [{ sub: 'google-sub-123', email: SECOND }] } });
    expect(await addressesOf()).toEqual([
      { address: PRIMARY, primary: true,  google: false },
      { address: SECOND,  primary: false, google: true  },
    ]);
  });

  it('never sends the Google account id', async () => {
    await User.updateOne({ _id: user._id },
      { $set: { googleIdentities: [{ sub: 'google-sub-123', email: PRIMARY }] } });
    const session = await issueSession(user);
    const res = await me(session.accessToken);
    expect(JSON.stringify(res.body)).not.toContain('google-sub-123');
    expect(res.body.data).not.toHaveProperty('googleIdentities');
  });

  it('lists only the primary when the account has no other address', async () => {
    await User.updateOne({ _id: user._id }, { $set: { loginEmails: [] } });
    expect(await addressesOf()).toEqual([
      { address: PRIMARY, primary: true, google: false },
    ]);
  });
});

/*
 * PF-131 (owner, 2026-10-27) — the Account card also names HOW this login
 * signed in. The Google door's half is in google.auth.test.js. Two logins
 * here; the authLimiter budget for this file stays under 10.
 */
describe('GET /api/auth/me — signedInWith', () => {
  it('names the password door after a password sign-in', async () => {
    expect((await meAfterLogin(PRIMARY)).signedInWith).toBe('password');
  });

  it('keeps naming it after a refresh rotates the session', async () => {
    const first = await login(SECOND);
    const next  = await request(app).post('/api/auth/refresh')
      .send({ refreshToken: first.body.refreshToken });
    expect(next.status).toBe(200);
    expect((await me(next.body.accessToken)).body.data.signedInWith).toBe('password');
  });

  it('says null — never a guess — for a session that recorded no method', async () => {
    const session = await issueSession(user);
    expect((await me(session.accessToken)).body.data.signedInWith).toBeNull();
  });
});
