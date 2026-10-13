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
