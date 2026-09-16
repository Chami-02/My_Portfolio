const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../app');
const User    = require('../models/User');
const { issueSession } = require('../services/sessionService');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

beforeAll(connectTestDB);
afterEach(clearDB);
afterAll(disconnectTestDB);

const ADMIN = { email: 'admin@test.com', password: 'TestPass@1234!' };

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await User.create(ADMIN);
  });

  it('returns an access token and a refresh token on successful login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send(ADMIN);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    // The access token is a JWT: 3 dot-separated base64 parts
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.accessToken.split('.').length).toBe(3);
    // The refresh token is opaque — 32 random bytes, base64url
    expect(typeof res.body.refreshToken).toBe('string');
    expect(res.body.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    // PF-108: the pre-PF-108 bare `token` is gone, not merely joined
    expect(res.body.token).toBeUndefined();
  });

  it('tells the client when each token expires, as ISO dates in the future', async () => {
    const before = Date.now();
    const res = await request(app).post('/api/auth/login').send(ADMIN);

    const access  = Date.parse(res.body.accessExpiresAt);
    const refresh = Date.parse(res.body.refreshExpiresAt);
    expect(Number.isNaN(access)).toBe(false);
    expect(Number.isNaN(refresh)).toBe(false);
    expect(access).toBeGreaterThan(before);
    // The refresh token must outlive the access token, or refresh is pointless
    expect(refresh).toBeGreaterThan(access);
  });

  it('returns user data (without password) on login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send(ADMIN);

    expect(res.body.data.email).toBe(ADMIN.email);
    expect(res.body.data.password).toBeUndefined();
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN.email, password: 'WrongPassword!' });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid/i);
  });

  it('returns 401 for nonexistent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: ADMIN.password });

    expect(res.status).toBe(401);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: ADMIN.password });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 when an invalid token is provided', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });

  it('returns user data and the session expiry with a valid token', async () => {
    await User.create(ADMIN);
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send(ADMIN);
    const token = loginRes.body.accessToken;

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.email).toBe(ADMIN.email);
    // The client cannot read `exp` out of a token it treats as opaque, so
    // /me reports it — and it must be the SAME instant login reported.
    expect(meRes.body.sessionExpiresAt).toBe(loginRes.body.accessExpiresAt);
  });

  it('returns 401 when the token user no longer exists', async () => {
    const user = await User.create(ADMIN);
    const { accessToken } = await issueSession(user);
    await User.deleteOne({ _id: user._id });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/no longer exists/i);
  });

  it('returns 401 when the token is expired', async () => {
    const user = await User.create(ADMIN);
    const token = jwt.sign(
      { id: user._id, fam: 'any' },
      process.env.JWT_SECRET,
      { expiresIn: '-1s' }
    );

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/expired/i);
  });

  // PF-108: a token in the pre-PF-108 shape — correctly signed, unexpired,
  // but naming no session family — must be refused. Otherwise a 7-day token
  // issued before the change would keep working for a week after it.
  it('returns 401 for a correctly signed token that names no session', async () => {
    const user = await User.create(ADMIN);
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/session has ended/i);
  });
});
