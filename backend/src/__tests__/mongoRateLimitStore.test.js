/**
 * PF-141 — the MongoDB rate-limit store.
 *
 * The property the ticket exists for is the first test: two SEPARATE limiter
 * instances — what two Vercel instances are — enforce ONE cap between them.
 * Its control runs the same requests through the default memory store and
 * shows they get double the budget, so the test can tell the two apart.
 */
const express   = require('express');
const request   = require('supertest');
const rateLimit = require('express-rate-limit');
const RateLimit = require('../models/RateLimit');
const MongoStore = require('../middleware/mongoRateLimitStore');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

beforeAll(connectTestDB);
afterEach(clearDB);
afterAll(disconnectTestDB);

const WINDOW = 15 * 60 * 1000;

// One "instance": its own app and its own limiter, as a fresh Vercel
// instance would build them. `store` omitted = express-rate-limit's memory store.
const instance = (store) => {
  const app = express();
  app.post('/', rateLimit({ windowMs: WINDOW, max: 10, store, legacyHeaders: false }), (_req, res) => res.json({ ok: true }));
  return app;
};
const hit = (app) => request(app).post('/');

const storeFor = (name) => {
  const store = new MongoStore(name);
  store.init({ windowMs: WINDOW });
  return store;
};

describe('two instances share one count', () => {
  it('10 per window means 10 in total, whichever instance serves the request', async () => {
    const a = instance(new MongoStore('shared'));
    const b = instance(new MongoStore('shared'));

    for (let i = 0; i < 6; i += 1) expect((await hit(a)).status).toBe(200);
    for (let i = 0; i < 4; i += 1) expect((await hit(b)).status).toBe(200);

    expect((await hit(b)).status).toBe(429);
    expect((await hit(a)).status).toBe(429);
  });

  it('control — two memory stores let the same client through 20 times', async () => {
    const a = instance();
    const b = instance();

    for (let i = 0; i < 10; i += 1) expect((await hit(a)).status).toBe(200);
    for (let i = 0; i < 10; i += 1) expect((await hit(b)).status).toBe(200);
  });
});

describe('MongoStore', () => {
  it('counts concurrent requests atomically — 20 at once is 20', async () => {
    const store = storeFor('burst');
    await Promise.all(Array.from({ length: 20 }, () => store.increment('1.2.3.4')));

    const row = await RateLimit.findById('burst:1.2.3.4').lean();
    expect(row.hits).toBe(20);
  });

  it('opens a window on the first hit and keeps its end on later hits', async () => {
    const store = storeFor('win');
    const before = Date.now();
    const first  = await store.increment('k');
    const second = await store.increment('k');

    expect(first.totalHits).toBe(1);
    expect(second.totalHits).toBe(2);
    expect(first.resetTime.getTime()).toBeGreaterThanOrEqual(before + WINDOW - 1000);
    expect(first.resetTime.getTime()).toBeLessThanOrEqual(Date.now() + WINDOW + 1000);
    expect(second.resetTime.getTime()).toBe(first.resetTime.getTime());
  });

  it('a hit inside an open window never moves its end', async () => {
    // Two back-to-back hits can share a millisecond and hide a moving end —
    // a window opened five minutes ago cannot.
    const store = storeFor('fixed');
    const end = new Date(Date.now() + 5 * 60 * 1000);
    await RateLimit.create({ _id: 'fixed:k', hits: 3, resetAt: end });

    const res = await store.increment('k');
    expect(res.totalHits).toBe(4);
    expect(res.resetTime.getTime()).toBe(end.getTime());
  });

  it('starts again at 1 once the window has closed, even before the TTL sweep removes the row', async () => {
    const store = storeFor('old');
    await RateLimit.create({ _id: 'old:k', hits: 99, resetAt: new Date(Date.now() - 1000) });

    const res = await store.increment('k');
    expect(res.totalHits).toBe(1);
    expect(res.resetTime.getTime()).toBeGreaterThan(Date.now() + WINDOW - 60 * 1000);
    expect(await store.get('k')).toEqual({ totalHits: 1, resetTime: res.resetTime });
  });

  it('get answers nothing for an unknown key or a closed window', async () => {
    const store = storeFor('get');
    expect(await store.get('nobody')).toBeUndefined();

    await RateLimit.create({ _id: 'get:k', hits: 3, resetAt: new Date(Date.now() - 1000) });
    expect(await store.get('k')).toBeUndefined();
  });

  it('keeps limiters apart by prefix', async () => {
    await storeFor('auth').increment('9.9.9.9');
    await storeFor('auth').increment('9.9.9.9');
    const other = await storeFor('forgot').increment('9.9.9.9');

    expect(other.totalHits).toBe(1);
    expect((await RateLimit.findById('auth:9.9.9.9').lean()).hits).toBe(2);
  });

  it('decrement un-counts inside the window, and never touches a closed one', async () => {
    const store = storeFor('dec');
    await store.increment('k');
    await store.increment('k');
    await store.decrement('k');
    expect((await RateLimit.findById('dec:k').lean()).hits).toBe(1);

    await RateLimit.create({ _id: 'dec:old', hits: 4, resetAt: new Date(Date.now() - 1000) });
    await store.decrement('old');
    expect((await RateLimit.findById('dec:old').lean()).hits).toBe(4);
  });

  it('resetKey deletes the count', async () => {
    const store = storeFor('rst');
    await store.increment('k');
    await store.resetKey('k');
    expect(await RateLimit.findById('rst:k')).toBeNull();
  });

  it('retries once when two first requests race to insert the row', async () => {
    const store = storeFor('race');
    const real  = RateLimit.findOneAndUpdate.bind(RateLimit);
    const spy   = jest.spyOn(RateLimit, 'findOneAndUpdate')
      .mockImplementationOnce(() => ({ lean: () => Promise.reject(Object.assign(new Error('E11000'), { code: 11000 })) }))
      .mockImplementation(real);

    try {
      expect((await store.increment('k')).totalHits).toBe(1);
      expect(spy).toHaveBeenCalledTimes(2);
    } finally {
      spy.mockRestore();
    }
  });

  it('does not swallow any other database error', async () => {
    const store = storeFor('boom');
    const spy = jest.spyOn(RateLimit, 'findOneAndUpdate')
      .mockImplementation(() => ({ lean: () => Promise.reject(new Error('network down')) }));

    try {
      await expect(store.increment('k')).rejects.toThrow('network down');
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('garbage-collects closed windows with a TTL index on resetAt', async () => {
    await RateLimit.init();
    const indexes = await RateLimit.collection.indexes();
    const ttl = indexes.find((i) => i.key.resetAt === 1);
    expect(ttl).toBeDefined();
    expect(ttl.expireAfterSeconds).toBe(0);
  });
});

describe('when the store fails', () => {
  let spy;
  beforeEach(() => {
    spy = jest.spyOn(RateLimit, 'findOneAndUpdate')
      .mockImplementation(() => ({ lean: () => Promise.reject(new Error('network down')) }));
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('globalLimiter fails OPEN — /api/health must answer during an outage', async () => {
    // Its `skip` under NODE_ENV=test would hide the store entirely.
    const env = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      const { globalLimiter } = require('../middleware/rateLimiter');
      const app = express();
      app.get('/', globalLimiter, (_req, res) => res.json({ ok: true }));

      expect((await request(app).get('/')).status).toBe(200);
      expect(spy).toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = env;
    }
  });

  // Doubles as the wiring guard: a limiter that lost its MongoStore would
  // count in memory, ignore the failing database and call the handler.
  it.each([
    'authLimiter', 'refreshLimiter', 'googleLimiter', 'contactLimiter',
    'forgotLimiter', 'resetLimiter', 'changeLimiter', 'sessionsLimiter', 'backupLimiter',
  ])('%s counts in MongoDB and fails CLOSED — no request reaches the handler', async (name) => {
    const limiter = require('../middleware/rateLimiter')[name];
    const handler = jest.fn((_req, res) => res.json({ ok: true }));
    const app = express();
    app.post('/', limiter, handler);
    app.use((_err, _req, res, _next) => res.status(500).json({ status: 'error' }));

    expect((await request(app).post('/')).status).toBe(500);
    expect(handler).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
  });

  it('the blog view counter counts in MongoDB too', async () => {
    const app = require('../app');
    const res = await request(app).patch('/api/blog/any-post/view');

    expect(res.status).toBe(500);
    expect(spy).toHaveBeenCalled();
  });
});

describe('before the app has connected', () => {
  // The global limiter runs ahead of app.js's connectDB() middleware, so on a
  // cold start the store is the first thing to touch the database.
  it('the store opens the connection itself', async () => {
    const mongoose = require('mongoose');
    await mongoose.disconnect();
    // A cold instance: connectDB()'s per-instance cache is empty too.
    Object.assign(global._mongooseConnection, { conn: null, promise: null });

    const store = storeFor('cold');
    expect((await store.increment('k')).totalHits).toBe(1);
    expect(mongoose.connection.readyState).toBe(1);
  });
});
