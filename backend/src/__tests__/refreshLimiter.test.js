/**
 * PF-108 — `refreshLimiter` caps POST /api/auth/refresh at 60 per 15 min.
 *
 * ⚠️ Its OWN file on purpose: inside session.test.js every real refresh
 * call would count against this budget and the threshold would depend on how
 * many tests ran before it. Since PF-141 the count lives in the test database
 * (MongoStore), which this file empties before it starts, so the number below
 * is exact.
 *
 * Mounted on a stub app rather than the real one: what is under test is the
 * limiter's threshold, not the refresh handler.
 */
const express = require('express');
const request = require('supertest');
const { refreshLimiter } = require('../middleware/rateLimiter');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

beforeAll(async () => { await connectTestDB(); await clearDB(); });
afterAll(disconnectTestDB);

const app = express();
app.post('/refresh', refreshLimiter, (_req, res) => res.json({ ok: true }));

describe('refreshLimiter', () => {
  it('allows 60 refreshes, then 429s the 61st with the JSON body', async () => {
    for (let i = 1; i <= 60; i += 1) {
      const res = await request(app).post('/refresh');
      expect(res.status).toBe(200);
    }

    const blocked = await request(app).post('/refresh');
    expect(blocked.status).toBe(429);
    expect(blocked.body.status).toBe('fail');
    expect(blocked.body.message).toMatch(/session refreshes/i);
  });

  // ⚠️ No "is looser than authLimiter" assertion: express-rate-limit v8
  // exposes no getOptions(), so the only honest way to compare the two caps
  // is the threshold above (60) against authLimiter's documented 10 — and a
  // test that read the numbers out of fallbacks would pass with nothing
  // behind it.
});
