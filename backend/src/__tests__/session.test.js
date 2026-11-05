/**
 * PF-108 — the session model: rotation, reuse detection, logout, revoke-all.
 *
 * Every case drives the real HTTP surface (login → refresh → /me) rather
 * than the service alone, because the property under test is "what a
 * client holding token X can still DO", and only the routes answer that.
 */
const mongoose = require('mongoose');
const request = require('supertest');
const app     = require('../app');
const User    = require('../models/User');
const Session = require('../models/Session');
const {
  issueSession,
  revokeAllForUser,
  hashToken,
} = require('../services/sessionService');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');
const { asOurSite, refreshCookieOf } = require('./helpers/refreshCookie');

beforeAll(connectTestDB);
afterEach(clearDB);
afterAll(disconnectTestDB);

const ADMIN = { email: 'admin@test.com', password: 'TestPass@1234!' };

// ⚠️ NOT `POST /api/auth/login`. `authLimiter` (10 / 15 min) is deliberately
// live under NODE_ENV=test, and this file signs in far more than ten times —
// the first run of it 429'd from the seventh test on. The login ROUTE is
// auth.test.js's job; here the property under test is what a client holding
// a given pair can still DO, and `issueSession` is exactly what login calls.
const login = async () => {
  const user = await User.findOne({ email: ADMIN.email });
  return issueSession(user);
};

const refresh = (refreshToken) =>
  asOurSite(request(app).post('/api/auth/refresh'), refreshToken);

const logout = (refreshToken) =>
  asOurSite(request(app).post('/api/auth/logout'), refreshToken);

// PF-147 — a repeat inside the window is tolerated, so a test of what happens
// AFTER it moves every rotation further into the past than the window reaches.
const pastTheWindow = () =>
  Session.updateMany(
    { replacedBy: { $ne: null } },
    { $set: { revokedAt: new Date(Date.now() - 61 * 1000) } }
  );

const me = (accessToken) =>
  request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`);

beforeEach(async () => {
  await User.create(ADMIN);
});

describe('Session storage', () => {
  it('stores only a hash of the refresh token, never the token itself', async () => {
    const { refreshToken } = await login();

    const rows = await Session.find({});
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(hashToken(refreshToken));
    // The raw token appears nowhere in the stored document
    expect(JSON.stringify(rows[0].toObject())).not.toContain(refreshToken);
  });

  it('starts a NEW family on every login', async () => {
    await login();
    await login();

    const families = new Set((await Session.find({})).map((s) => s.family));
    expect(families.size).toBe(2);
  });
});

describe('POST /api/auth/refresh — rotation', () => {
  it('returns a new pair and keeps the user signed in', async () => {
    const first = await login();
    const res   = await refresh(first.refreshToken);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(refreshCookieOf(res)).toEqual(expect.any(String));
    expect(refreshCookieOf(res)).not.toBe(first.refreshToken);
    expect(res.body.data.email).toBe(ADMIN.email);

    // The new access token works
    expect((await me(res.body.accessToken)).status).toBe(200);
  });

  it('keeps the successor in the SAME family, linked from the row it replaced', async () => {
    const first = await login();
    await refresh(first.refreshToken);

    const rows = await Session.find({}).sort({ createdAt: 1 });
    expect(rows).toHaveLength(2);
    expect(rows[0].family).toBe(rows[1].family);
    expect(rows[0].revokedAt).not.toBeNull();
    expect(String(rows[0].replacedBy)).toBe(String(rows[1]._id));
    expect(rows[1].revokedAt).toBeNull();
  });

  it('slides the refresh expiry forward on every rotation', async () => {
    const first = await login();
    const [row] = await Session.find({});
    // Age the first row so the successor's expiry is measurably later
    await Session.updateOne(
      { _id: row._id },
      { $set: { expiresAt: new Date(Date.now() + 60 * 1000) } }
    );

    const res = await refresh(first.refreshToken);
    expect(Date.parse(res.body.refreshExpiresAt))
      .toBeGreaterThan(Date.now() + 60 * 1000);
  });

  it('the access token issued BEFORE a rotation keeps working until it expires', async () => {
    // Rotation replaces the refresh token, not the family; a request that
    // was already in flight with the older access token must not 401.
    const first = await login();
    await refresh(first.refreshToken);

    expect((await me(first.accessToken)).status).toBe(200);
  });

  it('returns 401 for a token that was never issued', async () => {
    const res = await refresh('a'.repeat(43));
    expect(res.status).toBe(401);
  });

  it('returns 401 when no refresh token is sent', async () => {
    const res = await asOurSite(request(app).post('/api/auth/refresh'));
    expect(res.status).toBe(401);
  });

  it('returns 401 for a refresh token whose row has expired', async () => {
    const first = await login();
    await Session.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await refresh(first.refreshToken);
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/session has ended/i);
  });

  it('returns 401 when the user behind the session no longer exists', async () => {
    const first = await login();
    await User.deleteMany({});

    const res = await refresh(first.refreshToken);
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/session has ended/i);
  });
});

describe('POST /api/auth/refresh — reuse detection', () => {
  it('a rotated token presented AGAIN is refused', async () => {
    const first = await login();
    await refresh(first.refreshToken);
    await pastTheWindow();

    const res = await refresh(first.refreshToken);
    expect(res.status).toBe(401);
  });

  it('…and the reuse revokes the WHOLE family, successor included', async () => {
    const first  = await login();
    const second = await refresh(first.refreshToken);
    await pastTheWindow();

    // Attacker (or stale tab) replays the old token
    await refresh(first.refreshToken);

    // The legitimate successor is now dead too — both parties are out
    expect((await refresh(refreshCookieOf(second))).status).toBe(401);
    // …and so is the successor's still-unexpired access token
    expect((await me(second.body.accessToken)).status).toBe(401);

    const live = await Session.countDocuments({ revokedAt: null });
    expect(live).toBe(0);
  });

  it('says so in the server log, without the token', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const first = await login();
    await refresh(first.refreshToken);
    expect(warn).not.toHaveBeenCalled();
    await pastTheWindow();

    await refresh(first.refreshToken);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/used refresh token/i);
    expect(warn.mock.calls[0][0]).not.toContain(first.refreshToken);
    warn.mockRestore();
  });

  it('reuse in one family does not touch another', async () => {
    const a = await login();           // family A
    const b = await login();           // family B
    await refresh(a.refreshToken);
    await pastTheWindow();
    await refresh(a.refreshToken);     // reuse → A dies

    expect((await me(b.accessToken)).status).toBe(200);
    expect((await refresh(b.refreshToken)).status).toBe(200);
  });
});

// PF-147 — every row of the table in sessionService.answerUsedToken.
describe('POST /api/auth/refresh — a repeat inside the window', () => {
  const liveRows = () => Session.countDocuments({ revokedAt: null });

  it('a lost reply recovers: the repeat gets a working token and the old successor dies', async () => {
    const first = await login();
    const lost  = await refresh(first.refreshToken);   // this reply never arrives

    const res = await refresh(first.refreshToken);

    expect(res.status).toBe(200);
    expect((await me(res.body.accessToken)).status).toBe(200);
    expect(refreshCookieOf(res)).not.toBe(refreshCookieOf(lost));
    expect((await refresh(refreshCookieOf(res))).status).toBe(200);
  });

  it('keeps exactly ONE live row in the family, as the Sessions card relies on', async () => {
    const first = await login();
    await refresh(first.refreshToken);
    await refresh(first.refreshToken);
    expect(await liveRows()).toBe(1);

    await refresh(first.refreshToken);   // a third try still finds the live row
    expect(await liveRows()).toBe(1);
  });

  it('copies the sign-in details onto the replacement', async () => {
    const user = await User.findOne({ email: ADMIN.email });
    const first = await issueSession(user, { signedInAs: ADMIN.email, signInMethod: 'password', device: 'Chrome on macOS' });
    await refresh(first.refreshToken);
    await refresh(first.refreshToken);

    const live = await Session.findOne({ revokedAt: null });
    expect(live).toMatchObject({ signedInAs: ADMIN.email, signInMethod: 'password', device: 'Chrome on macOS' });
  });

  it('a token that was SIGNED OUT is never revived, even a moment later', async () => {
    const first = await login();
    await logout(first.refreshToken);

    const res = await refresh(first.refreshToken);

    expect(res.status).toBe(401);
    expect(await liveRows()).toBe(0);
  });

  it('a ROTATED token cannot revive a session signed out since', async () => {
    const first  = await login();
    const second = await refresh(first.refreshToken);
    await logout(refreshCookieOf(second));

    const res = await refresh(first.refreshToken);

    expect(res.status).toBe(401);
    expect(await liveRows()).toBe(0);
    expect((await me(first.accessToken)).status).toBe(401);
  });

  it('ends the family when the successor has itself rotated: someone else holds it', async () => {
    const first  = await login();
    const second = await refresh(first.refreshToken);
    await refresh(refreshCookieOf(second));

    const res = await refresh(first.refreshToken);

    expect(res.status).toBe(401);
    expect(await liveRows()).toBe(0);
  });

  it('answers 503 and changes nothing while the first request is still creating the successor', async () => {
    const first = await login();
    const row = await Session.findOne({});
    const pending = new mongoose.Types.ObjectId();
    await Session.updateOne({ _id: row._id }, { $set: { revokedAt: new Date(), replacedBy: pending } });

    const res = await refresh(first.refreshToken);

    expect(res.status).toBe(503);
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(String((await Session.findById(row._id)).replacedBy)).toBe(String(pending));
    expect(await Session.countDocuments({})).toBe(1);
  });

  it('two requests racing with one token leave the session alive, with one live row', async () => {
    const first = await login();

    const answers = await Promise.all([refresh(first.refreshToken), refresh(first.refreshToken)]);

    expect(answers.map((r) => r.status)).toContain(200);
    answers.forEach((r) => expect([200, 503]).toContain(r.status));
    expect(await liveRows()).toBe(1);
  });
});

describe('POST /api/auth/logout', () => {
  it('kills the access token immediately, not at its own expiry', async () => {
    const first = await login();
    expect((await me(first.accessToken)).status).toBe(200);

    const out = await logout(first.refreshToken);
    expect(out.status).toBe(200);

    expect((await me(first.accessToken)).status).toBe(401);
  });

  it('kills the refresh token too', async () => {
    const first = await login();
    await logout(first.refreshToken);

    expect((await refresh(first.refreshToken)).status).toBe(401);
  });

  it('is 200 for an unknown token and for no token at all', async () => {
    expect((await logout('nope')).status).toBe(200);
    expect((await asOurSite(request(app).post('/api/auth/logout'))).status).toBe(200);
  });

  it('does not need a valid access token', async () => {
    // No Authorization header at all — a client whose session has ended
    // must still be able to sign out cleanly.
    const first = await login();
    const out = await logout(first.refreshToken);
    expect(out.status).toBe(200);
  });
});

describe('revokeAllForUser — the hook PF-124 will call', () => {
  it('ends every session of the user, on every device', async () => {
    const user = await User.findOne({ email: ADMIN.email });
    const a = await login();
    const b = await login();
    const c = await issueSession(user);

    await revokeAllForUser(user._id);

    expect((await me(a.accessToken)).status).toBe(401);
    expect((await me(b.accessToken)).status).toBe(401);
    expect((await me(c.accessToken)).status).toBe(401);
    expect((await refresh(a.refreshToken)).status).toBe(401);
  });

  it('leaves another user\'s sessions alone', async () => {
    const other = await User.create({ email: 'other@test.com', password: 'OtherPass@1234!' });
    const mine  = await login();
    const theirs = await issueSession(other);

    const user = await User.findOne({ email: ADMIN.email });
    await revokeAllForUser(user._id);

    expect((await me(mine.accessToken)).status).toBe(401);
    expect((await me(theirs.accessToken)).status).toBe(200);
  });
});

// PF-120 — `protect` accepts HS256 only, the algorithm issueSession signs with.
describe('Access token algorithm', () => {
  const jwt = require('jsonwebtoken');

  it('refuses a token signed with the right secret but another algorithm', async () => {
    const session = await login();
    const { id, fam } = jwt.decode(session.accessToken);
    const hs512 = jwt.sign({ id, fam }, process.env.JWT_SECRET, { algorithm: 'HS512', expiresIn: '15m' });

    expect((await me(session.accessToken)).status).toBe(200);   // control: the family is live
    expect((await me(hs512)).status).toBe(401);
  });
});
