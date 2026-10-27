// backend/src/__tests__/auth.loginShape.test.js
//
// The login body's SHAPE is checked by `loginRules` in the route (CodeQL
// js/user-controlled-bypass, 2026-10-14: the old in-controller `!email` was a
// user-controlled condition guarding sign-in). Same contract as before: one
// 400 message, and a non-string never reaches the user lookup as a Mongo
// operand.
//
// ⚠️ Its OWN file on purpose: authLimiter (10 / 15 min) is live under test.
// Six more attempts in auth.test.js spent that file's budget and turned its
// later tests into 429s. (Since PF-141 the count is in the test database, so
// `afterEach(clearDB)` empties it too.)
const request = require('supertest');
const app     = require('../app');
const User    = require('../models/User');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

beforeAll(connectTestDB);
afterEach(clearDB);
afterAll(disconnectTestDB);

const ADMIN = { email: 'admin@test.com', password: 'TestPass@1234!' };

describe('POST /api/auth/login — body shape', () => {
  it.each([
    ['no password',        { email: ADMIN.email }],
    ['an empty email',     { email: '', password: ADMIN.password }],
    ['an array email',     { email: [ADMIN.email], password: ADMIN.password }],
    ['an operator email',  { email: { $ne: null }, password: ADMIN.password }],
    ['an object password', { email: ADMIN.email, password: { $ne: null } }],
    ['no body at all',     undefined],
  ])('refuses %s with the one 400 message', async (_label, body) => {
    await User.create(ADMIN);
    const res = await request(app).post('/api/auth/login').send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Please provide email and password');
  });

  it('a well-formed body still signs in (the rule is not a wall)', async () => {
    await User.create(ADMIN);
    const res = await request(app).post('/api/auth/login').send(ADMIN);
    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');
  });
});
