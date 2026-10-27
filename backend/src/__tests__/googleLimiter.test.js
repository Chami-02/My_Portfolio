/**
 * PF-119 — `googleLimiter` caps the three Google sign-in routes at 30 per
 * 15 min per IP, shared between them.
 *
 * Its own file for refreshLimiter.test.js's reason: the count lives in the
 * test database (PF-141), emptied before this file starts, so the number
 * below is exact. Stub app — the threshold is under test, not the handlers.
 */
const express = require('express');
const request = require('supertest');
const { googleLimiter } = require('../middleware/rateLimiter');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

beforeAll(async () => { await connectTestDB(); await clearDB(); });
afterAll(disconnectTestDB);

const app = express();
app.get('/start',     googleLimiter, (_req, res) => res.json({ ok: true }));
app.get('/callback',  googleLimiter, (_req, res) => res.json({ ok: true }));
app.post('/exchange', googleLimiter, (_req, res) => res.json({ ok: true }));

describe('googleLimiter', () => {
  it('allows 30 requests across ALL three routes, then 429s the 31st', async () => {
    // Ten whole sign-ins — start, callback, exchange — is exactly the budget.
    for (let i = 1; i <= 10; i += 1) {
      expect((await request(app).get('/start')).status).toBe(200);
      expect((await request(app).get('/callback')).status).toBe(200);
      expect((await request(app).post('/exchange')).status).toBe(200);
    }

    // One counter for the three routes: the 31st request is refused whichever
    // route it hits.
    const blocked = await request(app).get('/start');
    expect(blocked.status).toBe(429);
    expect(blocked.body.status).toBe('fail');
    expect(blocked.body.message).toMatch(/Google sign-in/i);
  });
});
