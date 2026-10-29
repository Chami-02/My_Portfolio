// PF-132 — the Settings Sessions card: list the signed-in devices, sign one
// out, sign out every other. Through the real routes, `protect`, controller,
// service and models — nothing mocked.
const request = require('supertest');
const app     = require('../app');
const User    = require('../models/User');
const Session = require('../models/Session');
const { issueSession, rotateSession, isFamilyLive, revokeFamily } = require('../services/sessionService');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

const PASSWORD = 'Owner-Password-123';
const CHROME_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const ORIGINAL = { ...process.env };

// authLimiter and sessionsLimiter are live under test — each case gets its own IP.
let ip = 0;
const nextIp = () => `10.132.${Math.floor(++ip / 250)}.${ip % 250}`;

let user, me, laptop, phone, from;

const familyOf = (session) =>
  JSON.parse(Buffer.from(session.accessToken.split('.')[1], 'base64url').toString()).fam;

const list = (session = me) =>
  request(app).get('/api/auth/sessions')
    .set('Authorization', `Bearer ${session.accessToken}`);
const revoke = (body, session = me) =>
  request(app).post('/api/auth/sessions/revoke')
    .set('Authorization', `Bearer ${session.accessToken}`)
    .set('X-Forwarded-For', from)
    .send(body);
const revokeOthers = (body, session = me) =>
  request(app).post('/api/auth/sessions/revoke-others')
    .set('Authorization', `Bearer ${session.accessToken}`)
    .set('X-Forwarded-For', from)
    .send(body);
const meStatus = async (session) =>
  (await request(app).get('/api/auth/me').set('Authorization', `Bearer ${session.accessToken}`)).status;

beforeAll(connectTestDB);
beforeEach(async () => {
  user   = await User.create({ email: 'owner@example.com', password: PASSWORD });
  me     = await issueSession(user, { signInMethod: 'password', device: 'Chrome on macOS' });
  laptop = await issueSession(user, { signInMethod: 'google', device: 'Firefox on Windows' });
  phone  = await issueSession(user, { signInMethod: 'password', device: 'Safari on iOS' });
  from   = nextIp();
});
afterEach(async () => {
  process.env = { ...ORIGINAL };
  await clearDB();
});
afterAll(disconnectTestDB);

describe('GET /api/auth/sessions', () => {
  it('refuses without a session', async () => {
    expect((await request(app).get('/api/auth/sessions')).status).toBe(401);
  });

  it('lists every live session, newest first, and marks THIS one', async () => {
    const res = await list();

    expect(res.status).toBe(200);
    expect(res.body.data.map((s) => s.device))
      .toEqual(['Safari on iOS', 'Firefox on Windows', 'Chrome on macOS']);
    expect(res.body.data.filter((s) => s.current).map((s) => s.id)).toEqual([familyOf(me)]);
  });

  it('leaves out ended and expired sessions, and other users', async () => {
    await request(app).post('/api/auth/logout').send({ refreshToken: phone.refreshToken });
    await Session.updateOne({ family: familyOf(laptop) }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    const stranger = await User.create({ email: 'stranger@example.com', password: PASSWORD });
    await issueSession(stranger, { device: 'Edge on Linux' });

    expect((await list()).body.data.map((s) => s.device)).toEqual(['Chrome on macOS']);
  });

  it('sends what the card shows — and no token or hash', async () => {
    const [row] = (await list(phone)).body.data;

    expect(Object.keys(row).sort()).toEqual([
      'current', 'device', 'id', 'lastActiveAt', 'location', 'signInMethod', 'signedInAs', 'startedAt',
    ]);
    expect(row).toMatchObject({ id: familyOf(phone), current: true, signInMethod: 'password', location: null });
    expect(JSON.stringify((await list()).body)).not.toMatch(/tokenHash|refresh/i);
  });

  it('a session from before PF-132 says less rather than guessing', async () => {
    await clearDB();
    user = await User.create({ email: 'owner@example.com', password: PASSWORD });
    me   = await issueSession(user);
    await Session.updateOne({ family: familyOf(me) }, { $unset: { startedAt: 1, device: 1 } });

    const [row] = (await list()).body.data;
    expect(row).toMatchObject({ device: null, startedAt: null, signInMethod: null });
  });
});

describe('sign-in records the device; rotation carries it', () => {
  it('a password sign-in stores the device label, never the raw User-Agent', async () => {
    const res = await request(app).post('/api/auth/login')
      .set('X-Forwarded-For', from)
      .set('User-Agent', CHROME_MAC)
      .send({ email: 'owner@example.com', password: PASSWORD });
    expect(res.status).toBe(200);

    const row = await Session.findOne({ tokenHash: { $exists: true }, device: 'Chrome on macOS', signInMethod: 'password', location: { $exists: false } }).lean();
    expect(row).not.toBeNull();
    expect(row.startedAt).toBeInstanceOf(Date);
    expect(JSON.stringify(await Session.find().lean())).not.toContain('AppleWebKit');
  });

  it('stores the approximate place on Vercel', async () => {
    process.env.VERCEL = '1';
    const res = await request(app).post('/api/auth/login')
      .set('X-Forwarded-For', from)
      .set('x-vercel-ip-city', 'Galle')
      .set('x-vercel-ip-country', 'LK')
      .send({ email: 'owner@example.com', password: PASSWORD });
    expect(res.status).toBe(200);

    const [row] = (await list(res.body)).body.data;
    expect(row.location).toBe('Galle, Sri Lanka');
  });

  it('every rotation keeps the device, place and first-seen time; last active moves', async () => {
    await Session.updateOne({ family: familyOf(me) }, { $set: { location: 'Galle, Sri Lanka' } });
    const before = (await list()).body.data.find((s) => s.current);

    await new Promise((r) => setTimeout(r, 15));
    const next = await rotateSession(me.refreshToken);
    const after = (await list(next)).body.data.find((s) => s.current);

    expect(after).toMatchObject({
      id: before.id, device: 'Chrome on macOS', location: 'Galle, Sri Lanka',
      signInMethod: 'password', startedAt: before.startedAt,
    });
    expect(new Date(after.lastActiveAt) > new Date(before.lastActiveAt)).toBe(true);
  });

  it('a pre-PF-132 session gets its start from its first rotation and keeps it', async () => {
    await Session.updateOne({ family: familyOf(me) }, { $unset: { startedAt: 1 } });
    const born = (await Session.findOne({ family: familyOf(me) })).createdAt;

    const one = await rotateSession(me.refreshToken);
    const two = await rotateSession(one.refreshToken);
    const row = (await list(two)).body.data.find((s) => s.current);

    expect(new Date(row.startedAt)).toEqual(born);
  });
});

describe('POST /api/auth/sessions/revoke', () => {
  it('with the right password, signs that device out AT ONCE — this one stays', async () => {
    const res = await revoke({ password: PASSWORD, id: familyOf(laptop) });

    expect(res.status).toBe(200);
    expect(await isFamilyLive(familyOf(laptop))).toBe(false);
    expect(await meStatus(laptop)).toBe(401);          // its 15-min access token died too
    expect(await isFamilyLive(familyOf(phone))).toBe(true);
    expect(await meStatus(me)).toBe(200);
  });

  it('a wrong password is a 400, never a 401, and ends nothing', async () => {
    const res = await revoke({ password: 'wrong password', id: familyOf(laptop) });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Your password is wrong.');
    expect(await isFamilyLive(familyOf(laptop))).toBe(true);
    expect(await meStatus(me)).toBe(200);
  });

  it('refuses THIS device — that is what Sign out is for', async () => {
    const res = await revoke({ password: PASSWORD, id: familyOf(me) });

    expect(res.status).toBe(400);
    expect(await isFamilyLive(familyOf(me))).toBe(true);
  });

  it("cannot reach another user's session", async () => {
    const stranger = await User.create({ email: 'stranger@example.com', password: PASSWORD });
    const theirs   = await issueSession(stranger);

    expect((await revoke({ password: PASSWORD, id: familyOf(theirs) })).status).toBe(404);
    expect(await isFamilyLive(familyOf(theirs))).toBe(true);
  });

  it('an unknown or already-ended session is a 404', async () => {
    await revoke({ password: PASSWORD, id: familyOf(laptop) });

    expect((await revoke({ password: PASSWORD, id: familyOf(laptop) })).status).toBe(404);
    expect((await revoke({ password: PASSWORD, id: 'no-such-family' })).status).toBe(404);
  });

  // `LAPTOP` stands for the laptop's real family id, which only exists once
  // beforeEach has run — the table is built before that.
  it.each([
    ['an array id',        { password: PASSWORD, id: ['LAPTOP'] }],
    ['an operator id',     { password: PASSWORD, id: { $ne: 'x' } }],
    ['no id',              { password: PASSWORD }],
    ['an array password',  { password: [PASSWORD], id: 'LAPTOP' }],
    ['no password',        { id: 'LAPTOP' }],
  ])('refuses %s with a 400 and ends NOTHING', async (_label, body) => {
    const sent = JSON.parse(JSON.stringify(body).replaceAll('"LAPTOP"', `"${familyOf(laptop)}"`));
    const res  = await revoke(sent);

    expect(res.status).toBe(400);
    expect(await Session.countDocuments({ revokedAt: { $ne: null } })).toBe(0);
  });

  // The query is safe on its own, not only behind the route's rule.
  // With `$eq` Mongoose refuses the object (CastError); without it, `$ne`
  // matched — and ended — every one of this user's sessions.
  it('revokeFamily never reads an operator object as a query — it ends nothing', async () => {
    const ended = await revokeFamily(user._id, { $ne: 'x' }).catch(() => false);

    expect(ended).toBe(false);
    expect(await Session.countDocuments({ revokedAt: { $ne: null } })).toBe(0);
  });
});

describe('POST /api/auth/sessions/revoke-others', () => {
  it('with the right password, signs out every other device — not this one, not other users', async () => {
    const stranger = await User.create({ email: 'stranger@example.com', password: PASSWORD });
    const theirs   = await issueSession(stranger);

    const res = await revokeOthers({ password: PASSWORD });

    expect(res.status).toBe(200);
    expect(await isFamilyLive(familyOf(laptop))).toBe(false);
    expect(await isFamilyLive(familyOf(phone))).toBe(false);
    expect(await isFamilyLive(familyOf(me))).toBe(true);
    expect(await isFamilyLive(familyOf(theirs))).toBe(true);
    expect((await list()).body.data.map((s) => s.id)).toEqual([familyOf(me)]);
  });

  it('a wrong password is a 400 and ends nothing', async () => {
    const res = await revokeOthers({ password: 'wrong password' });

    expect(res.status).toBe(400);
    expect(await Session.countDocuments({ revokedAt: { $ne: null } })).toBe(0);
  });

  it('an empty password is "required", not "wrong" — and never reaches bcrypt', async () => {
    const res = await revokeOthers({ password: '' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Password is required');
  });

  it.each([
    ['an array password', { password: [PASSWORD] }],
    ['no password',       {}],
  ])('refuses %s with a 400 and ends nothing', async (_label, body) => {
    expect((await revokeOthers(body)).status).toBe(400);
    expect(await Session.countDocuments({ revokedAt: { $ne: null } })).toBe(0);
  });

  it('refuses without a session', async () => {
    const res = await request(app).post('/api/auth/sessions/revoke-others').send({ password: PASSWORD });
    expect(res.status).toBe(401);
  });
});

describe('sessionsLimiter', () => {
  it('allows 10 password checks per 15 minutes, shared by both routes, then 429', async () => {
    for (let i = 0; i < 5; i += 1) {
      expect((await revoke({ password: 'wrong', id: 'x' })).status).toBe(400);
      expect((await revokeOthers({ password: 'wrong' })).status).toBe(400);
    }
    expect((await revokeOthers({ password: PASSWORD })).status).toBe(429);
    expect(await isFamilyLive(familyOf(laptop))).toBe(true);
  });

  it('does not limit the list', async () => {
    for (let i = 0; i < 12; i += 1) expect((await list()).status).toBe(200);
  });
});
