/**
 * PF-120 — `contactLimiter`: 5 STORED messages per hour per IP.
 *
 * Its own file for refreshLimiter.test.js's reason — the counter lives on the
 * limiter instance and a fresh file is a fresh instance, so the numbers are
 * exact. Through the REAL app, so the route wiring is under test too.
 */
const request = require('supertest');
const app     = require('../app');
const Contact = require('../models/Contact');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

beforeAll(connectTestDB);
afterAll(async () => { await clearDB(); await disconnectTestDB(); });

const VALID = { name: 'Visitor', email: 'visitor@example.com', message: 'Hello there, a real message.' };
const send  = (body) => request(app).post('/api/contact').send(body);

describe('contactLimiter (PF-120)', () => {
  it('stores five messages, refuses the sixth — and refused 400s never count', async () => {
    // Failed submissions first: if they counted, the budget would be gone.
    for (let i = 0; i < 6; i += 1) {
      expect((await send({ ...VALID, email: 'not-an-address' })).status).toBe(400);
    }
    for (let i = 0; i < 5; i += 1) {
      expect((await send(VALID)).status).toBe(201);
    }

    const blocked = await send(VALID);
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toMatch(/try again in an hour/);
    expect(await Contact.countDocuments()).toBe(5);
  });
});
