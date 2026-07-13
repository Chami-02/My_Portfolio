const request = require('supertest');
const app     = require('../app');
const User    = require('../models/User');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

beforeAll(connectTestDB);
afterEach(clearDB);
afterAll(disconnectTestDB);

const ADMIN = { email: 'admin@test.com', password: 'TestPass@1234!' };

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await User.create(ADMIN);
  });

  it('returns a JWT token on successful login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send(ADMIN);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.token).toBeDefined();
    expect(typeof res.body.token).toBe('string');
    // JWT is 3 dot-separated base64 parts
    expect(res.body.token.split('.').length).toBe(3);
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

  it('returns user data with a valid token', async () => {
    await User.create(ADMIN);
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send(ADMIN);
    const token = loginRes.body.token;

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.email).toBe(ADMIN.email);
  });
});