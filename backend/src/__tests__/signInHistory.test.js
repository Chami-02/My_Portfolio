// PF-133 — the sign-in history, the new-device email, the leak check at
// sign-in and the daily digest. Through the real routes, controllers, models
// and mailer; only nodemailer's transport and the Have I Been Pwned call are
// replaced (the network edges).
jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));
jest.mock('../services/breachedPasswords', () => ({ isBreached: jest.fn() }));

const request     = require('supertest');
const nodemailer  = require('nodemailer');
const app         = require('../app');
const User        = require('../models/User');
const SignInEvent = require('../models/SignInEvent');
const { isBreached }  = require('../services/breachedPasswords');
const { afterSignIn, NEW_DEVICE_DAYS } = require('../services/signInLog');
const { issueSession } = require('../services/sessionService');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

const PRIMARY  = 'pcgallege@gmail.com';
const ALIAS    = 'parindrachameekara@gmail.com';
const PASSWORD = 'Owner-Password-133';
const SITE     = 'https://parindra.example';
const SECRET   = 'cron-secret-for-tests';
const CHROME_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const FIREFOX_WIN =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0';
const DAY_MS   = 24 * 60 * 60 * 1000;
const ORIGINAL = { ...process.env };
const sendMail = jest.fn();

// authLimiter is live under test — each case signs in from its own address.
let ip = 0;
const nextIp = () => `10.133.${Math.floor(++ip / 250)}.${ip % 250}`;

const login = (email, password = PASSWORD, ua = CHROME_MAC) =>
  request(app).post('/api/auth/login')
    .set('X-Forwarded-For', nextIp())
    .set('User-Agent', ua)
    .send({ email, password });

const cron = (auth) => {
  const req = request(app).get('/api/cron/digest');
  return auth === undefined ? req : req.set('Authorization', auth);
};

/** Polls until `check()` is truthy; fails the test after `ms`. */
const eventually = async (check, ms = 3000) => {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) throw new Error('condition never became true');
    await new Promise((r) => setTimeout(r, 20));
  }
};
// For "nothing happens" in the background: wait a window each test's CONTROL
// (a case that DOES send) shows is ample, then assert (auth.passwordReset's rule).
const settle = () => new Promise((r) => setTimeout(r, 300));

const events = () =>
  SignInEvent.find({}, '-_id kind outcome method address device location user')
    .sort({ createdAt: 1, _id: 1 }).lean();

let user, error;

beforeAll(connectTestDB);
beforeEach(async () => {
  process.env.GMAIL_USER = PRIMARY;
  process.env.GMAIL_APP_PASSWORD = 'abcdabcdabcdabcd';
  process.env.FRONTEND_URL = `${SITE}/`;
  sendMail.mockReset().mockResolvedValue({ messageId: 'x' });
  nodemailer.createTransport.mockReset().mockReturnValue({ sendMail });
  isBreached.mockReset().mockResolvedValue(false);
  error = jest.spyOn(console, 'error').mockImplementation(() => {});
  user = await User.create({ email: PRIMARY, loginEmails: [ALIAS], password: PASSWORD });
});
afterEach(async () => {
  await settle();                 // let background work finish before the wipe
  process.env = { ...ORIGINAL };
  jest.restoreAllMocks();
  await clearDB();
});
afterAll(disconnectTestDB);

describe('every sign-in attempt is recorded', () => {
  it('a wrong password and an unknown address: both failed, same answer', async () => {
    const wrong   = await login(PRIMARY, 'not-the-password-at-all');
    const unknown = await login('Stranger@Example.com', 'whatever-it-is');

    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
    expect(await events()).toEqual([
      { kind: 'sign-in', outcome: 'failed', method: 'password', address: PRIMARY, device: 'Chrome on macOS', user: user._id },
      // No account matched: no user — and the address as typed, lower-cased.
      { kind: 'sign-in', outcome: 'failed', method: 'password', address: 'stranger@example.com', device: 'Chrome on macOS', user: null },
    ]);
  });

  it('a success: ok, the address used in its stored spelling, the device label — never a secret', async () => {
    const res = await login(ALIAS.toUpperCase());
    expect(res.status).toBe(200);

    expect(await events()).toEqual([
      { kind: 'sign-in', outcome: 'ok', method: 'password', address: ALIAS, device: 'Chrome on macOS', user: user._id },
    ]);
    const stored = JSON.stringify(await SignInEvent.find().lean());
    expect(stored).not.toContain(PASSWORD);
    expect(stored).not.toContain('AppleWebKit');
  });

  it('stores the approximate place on Vercel', async () => {
    process.env.VERCEL = '1';
    await request(app).post('/api/auth/login')
      .set('X-Forwarded-For', nextIp())
      .set('x-vercel-ip-city', 'Galle')
      .set('x-vercel-ip-country', 'LK')
      .send({ email: PRIMARY, password: PASSWORD });

    expect((await events())[0].location).toBe('Galle, Sri Lanka');
  });

  it('a typed address is cut to 254 characters', async () => {
    await login(`${'a'.repeat(300)}@example.com`, 'whatever-it-is');
    expect((await events())[0].address).toHaveLength(254);
  });

  it('a log that cannot be written never stops a sign-in', async () => {
    jest.spyOn(SignInEvent, 'create').mockRejectedValue(new Error('disk full'));

    expect((await login(PRIMARY)).status).toBe(200);
    expect((await login(PRIMARY, 'not-the-password-at-all')).status).toBe(401);
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/\[PF-133\] Sign-in event not recorded: disk full/));
  });

  it('a reset request is recorded — failed for an unknown address', async () => {
    await request(app).post('/api/auth/password/forgot').set('X-Forwarded-For', nextIp()).send({ email: 'nobody@example.com' });
    await request(app).post('/api/auth/password/forgot').set('X-Forwarded-For', nextIp()).send({ email: ALIAS });

    const rows = await eventually(async () => {
      const all = await events();
      return all.length === 2 && all;
    });
    expect(rows.map(({ kind, outcome, address, user: u }) => ({ kind, outcome, address, known: Boolean(u) })))
      .toEqual(expect.arrayContaining([
        { kind: 'reset-request', outcome: 'failed', address: 'nobody@example.com', known: false },
        { kind: 'reset-request', outcome: 'ok', address: ALIAS, known: true },
      ]));
  });
});

describe('the new-device email', () => {
  const mails = () => sendMail.mock.calls.map(([m]) => m).filter((m) => /New sign-in/.test(m.subject));

  it('goes to the MAIN address and the one used, naming the device', async () => {
    await login(ALIAS);
    const [mail] = await eventually(() => mails().length === 1 && mails());

    expect(mail.to).toEqual([PRIMARY, ALIAS]);
    expect(mail.subject).toBe('New sign-in to your admin: Chrome on macOS');
    expect(mail.text).toContain(`last ${NEW_DEVICE_DAYS} days`);
    expect(mail.html).toContain('Chrome on macOS');
    // Not you? What to do, and a way straight there (owner, 2026-10-29).
    expect(mail.text).toContain('NOT YOU? DO THIS NOW\n1. Change your password: Settings → Password.');
    expect(mail.text).toContain("2. Sign out any device you don't recognise: Settings → Sessions.");
    expect(mail.text).toContain(`OPEN ADMIN: ${SITE}/admin`);
    expect(mail.html).toContain(`<a href="${SITE}/admin"`);
  });

  it('no button when the site address is not configured — the steps stay', async () => {
    delete process.env.FRONTEND_URL;
    await login(PRIMARY);
    const [mail] = await eventually(() => mails().length === 1 && mails());
    expect(mail.text).toContain('NOT YOU? DO THIS NOW');
    expect(mail.html).not.toContain('<a ');
  });

  it('one address only when the main one signed in', async () => {
    await login(PRIMARY);
    const [mail] = await eventually(() => mails().length === 1 && mails());
    expect(mail.to).toEqual([PRIMARY]);
  });

  it('is NOT sent again for the same device and place', async () => {
    await login(PRIMARY);
    await eventually(() => mails().length === 1);   // the control: the first one sends

    await login(PRIMARY);
    await settle();
    expect(mails()).toHaveLength(1);
  });

  it('IS sent for a different device', async () => {
    await login(PRIMARY);
    await eventually(() => mails().length === 1);

    await login(PRIMARY, PASSWORD, FIREFOX_WIN);
    const all = await eventually(() => mails().length === 2 && mails());
    expect(all[1].subject).toBe('New sign-in to your admin: Firefox on Windows');
  });

  it(`forgets a device after ${NEW_DEVICE_DAYS} days`, async () => {
    const seen = (days) => SignInEvent.create({
      user: user._id, kind: 'sign-in', outcome: 'ok', method: 'password',
      address: PRIMARY, device: 'Chrome on macOS', createdAt: new Date(Date.now() - days * DAY_MS),
    });

    await seen(NEW_DEVICE_DAYS - 1);
    await login(PRIMARY);
    await settle();
    expect(mails()).toHaveLength(0);

    await SignInEvent.deleteMany({});
    await seen(NEW_DEVICE_DAYS + 1);
    await login(PRIMARY);
    await eventually(() => mails().length === 1);
  });

  it('a FAILED attempt from a device does not make it known', async () => {
    await login(PRIMARY, 'not-the-password-at-all');
    await login(PRIMARY);
    await eventually(() => mails().length === 1);
  });

  it('a different place on the same device is new', async () => {
    process.env.VERCEL = '1';
    const from = (city) => request(app).post('/api/auth/login')
      .set('X-Forwarded-For', nextIp()).set('User-Agent', CHROME_MAC)
      .set('x-vercel-ip-city', city).set('x-vercel-ip-country', 'LK')
      .send({ email: PRIMARY, password: PASSWORD });

    await from('Galle');
    await eventually(() => mails().length === 1);
    await from('Galle');
    await settle();
    expect(mails()).toHaveLength(1);
    await from('Kandy');
    await eventually(() => mails().length === 2);
  });

  it('nothing is sent with mail off — and the sign-in still works', async () => {
    delete process.env.GMAIL_APP_PASSWORD;
    expect((await login(PRIMARY)).status).toBe(200);
    await settle();
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  it('a failed send never reaches the sign-in', async () => {
    sendMail.mockRejectedValue(Object.assign(new Error('smtp down'), { code: 'ECONNECTION' }));
    expect((await login(PRIMARY)).status).toBe(200);
    await eventually(() => error.mock.calls.some(([m]) => /\[PF-133\] New sign-in email failed: ECONNECTION smtp down/.test(m)));
  });
});

describe('the leak check at sign-in (NIST: change on evidence)', () => {
  const leakedAt = async () => (await User.findById(user._id).lean()).passwordLeakedAt;
  const meOf = async (res) =>
    (await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.accessToken}`)).body.data;

  it('a leaked password is flagged, and /auth/me says so', async () => {
    isBreached.mockResolvedValue(true);
    const res = await login(PRIMARY);

    await eventually(leakedAt);
    expect(isBreached).toHaveBeenCalledWith(PASSWORD);
    expect((await meOf(res)).passwordLeaked).toBe(true);
  });

  it('a clean check clears an old flag; a check that could not run changes nothing', async () => {
    await User.updateOne({ _id: user._id }, { $set: { passwordLeakedAt: new Date() } });

    isBreached.mockResolvedValue(null);
    await login(PRIMARY);
    await settle();
    expect(await leakedAt()).toBeInstanceOf(Date);

    isBreached.mockResolvedValue(false);
    const res = await login(PRIMARY);
    await eventually(async () => !(await leakedAt()));
    expect((await meOf(res)).passwordLeaked).toBe(false);
  });

  it('only a password sign-in is checked', async () => {
    await afterSignIn(user, null);
    expect(isBreached).not.toHaveBeenCalled();
  });

  it('a password changed since the sign-in is never marked by a check of the old one', async () => {
    isBreached.mockResolvedValue(true);
    const stale = await User.findById(user._id).select('+password');
    const fresh = await User.findById(user._id).select('+password +passwordHistory');
    fresh.setPassword('A-brand-new-password-133');
    await fresh.save();

    await afterSignIn(stale, null, { password: PASSWORD });
    expect(isBreached).toHaveBeenCalled();
    expect(await leakedAt()).toBeUndefined();
  });

  it('changing the password clears the flag', async () => {
    await User.updateOne({ _id: user._id }, { $set: { passwordLeakedAt: new Date() } });
    const account = await User.findById(user._id).select('+password +passwordHistory');
    account.setPassword('A-brand-new-password-133');
    await account.save();
    expect(await leakedAt()).toBeUndefined();
  });

  it('/auth/me sends when the password last changed (null before it was stamped)', async () => {
    const before = await meOf(await login(PRIMARY));
    expect(before.passwordChangedAt).toBeNull();
    expect(before.passwordLeaked).toBe(false);

    const account = await User.findById(user._id).select('+password +passwordHistory');
    account.setPassword('A-brand-new-password-133');
    await account.save();
    const after = await meOf(await login(PRIMARY, 'A-brand-new-password-133'));
    expect(new Date(after.passwordChangedAt).getTime()).toBe(account.passwordChangedAt.getTime());
  });
});

describe('GET /api/auth/sign-ins', () => {
  const history = (session) =>
    request(app).get('/api/auth/sign-ins').set('Authorization', `Bearer ${session.accessToken}`);

  it('refuses without a session', async () => {
    expect((await request(app).get('/api/auth/sign-ins')).status).toBe(401);
  });

  it("this account's events and the no-account ones, newest first — never another account's", async () => {
    const stranger = await User.create({ email: 'other@example.com', password: PASSWORD });
    const at = (min) => new Date(Date.now() - min * 60 * 1000);
    await SignInEvent.create([
      { user: user._id, kind: 'sign-in', outcome: 'ok', method: 'password', address: PRIMARY, createdAt: at(30) },
      { user: null, kind: 'sign-in', outcome: 'failed', method: 'password', address: 'guess@example.com', createdAt: at(20) },
      { user: stranger._id, kind: 'sign-in', outcome: 'ok', method: 'password', address: 'other@example.com', createdAt: at(15) },
      { user: user._id, kind: 'password-change', outcome: 'ok', address: ALIAS, createdAt: at(10) },
    ]);
    const res = await history(await issueSession(user));

    expect(res.status).toBe(200);
    expect(res.body.data.map((e) => e.address)).toEqual([ALIAS, 'guess@example.com', PRIMARY]);
    expect(Object.keys(res.body.data[0]).sort())
      .toEqual(['address', 'at', 'device', 'id', 'kind', 'location', 'method', 'outcome']);
    expect(res.body.data[0]).toMatchObject({ kind: 'password-change', method: null, device: null, location: null });
  });

  it('sends the newest 50', async () => {
    await SignInEvent.create(Array.from({ length: 55 }, (_, i) => ({
      user: user._id, kind: 'sign-in', outcome: 'ok', address: `n${i}@example.com`,
      createdAt: new Date(Date.now() - (55 - i) * 1000),
    })));
    const { data } = (await history(await issueSession(user))).body;
    expect(data).toHaveLength(50);
    expect(data[0].address).toBe('n54@example.com');
  });
});

describe('GET /api/cron/digest', () => {
  const digests = () => sendMail.mock.calls.map(([m]) => m).filter((m) => /Admin activity/.test(m.subject));
  const fail = (over = {}) => SignInEvent.create({
    user: null, kind: 'sign-in', outcome: 'failed', method: 'password', address: 'guess@example.com', ...over,
  });

  beforeEach(() => { process.env.CRON_SECRET = SECRET; });

  it.each([
    ['no header', undefined],
    ['a wrong secret', 'Bearer not-the-secret'],
    ['the secret without Bearer', SECRET],
  ])('refuses %s', async (_name, auth) => {
    await fail();
    expect((await cron(auth)).status).toBe(401);
    expect(await SignInEvent.countDocuments({ digestedAt: null })).toBe(1);
  });

  // "Bearer " + an empty secret cannot arrive over HTTP — Node trims a
  // header's trailing space — so the `secret.length > 0` guard is defence in
  // depth (its mutant survives, equivalent). What CAN arrive is pinned here.
  it('is OFF with no secret set', async () => {
    delete process.env.CRON_SECRET;
    expect((await cron('Bearer')).status).toBe(401);
    expect((await cron('Bearer undefined')).status).toBe(401);
  });

  it('a quiet day sends nothing', async () => {
    await SignInEvent.create({ user: user._id, kind: 'sign-in', outcome: 'ok', address: PRIMARY });
    const res = await cron(`Bearer ${SECRET}`);
    expect(res.body).toMatchObject({ sent: false, reason: 'quiet' });
    expect(digests()).toHaveLength(0);
  });

  it('one email to the MAIN address, counting failures; a second run sends nothing', async () => {
    await fail({ address: 'guess@example.com', device: 'Chrome on Linux' });
    await fail({ address: ALIAS });
    await SignInEvent.create({ kind: 'reset-request', outcome: 'failed', address: 'nobody@example.com' });
    await SignInEvent.create({ user: user._id, kind: 'sign-in', outcome: 'ok', address: PRIMARY });

    const first = await cron(`Bearer ${SECRET}`);
    expect(first.body).toMatchObject({ sent: true, count: 3 });
    const [mail] = digests();
    expect(mail.to).toBe(PRIMARY);
    expect(mail.subject).toBe('Admin activity: 3 failed attempts since the last summary');
    expect(mail.text).toContain('2 failed sign-ins and 1 reset request for unknown addresses');
    expect(mail.text).toContain('Failed sign-in · guess@example.com · Chrome on Linux');
    expect(mail.text).not.toContain(`${PRIMARY} ·`);   // the OK sign-in is not reported
    expect(mail.text).toContain('NOT YOU? DO THIS NOW');
    expect(mail.html).toContain(`<a href="${SITE}/admin"`);

    const second = await cron(`Bearer ${SECRET}`);
    expect(second.body).toMatchObject({ sent: false, reason: 'quiet' });
    expect(digests()).toHaveLength(1);
  });

  it('two runs at once send ONE email (each row is claimed by one run)', async () => {
    await fail();
    await fail();
    const [a, b] = await Promise.all([cron(`Bearer ${SECRET}`), cron(`Bearer ${SECRET}`)]);
    expect([a.body.sent, b.body.sent].filter(Boolean)).toHaveLength(1);
    expect(digests()).toHaveLength(1);
  });

  it('shows 10 rows and says how many more', async () => {
    await SignInEvent.create(Array.from({ length: 12 }, () => ({ kind: 'sign-in', outcome: 'failed', address: 'guess@example.com' })));
    await cron(`Bearer ${SECRET}`);
    expect(digests()[0].text).toContain('2 more in Settings → Sessions');
  });

  it('with mail off nothing is claimed — the rows wait', async () => {
    delete process.env.GMAIL_APP_PASSWORD;
    await fail();
    expect((await cron(`Bearer ${SECRET}`)).body).toMatchObject({ sent: false, reason: 'mail-off' });
    expect(await SignInEvent.countDocuments({ digestedAt: null })).toBe(1);
  });

  it('a failed send gives the rows back for tomorrow', async () => {
    await fail();
    sendMail.mockRejectedValueOnce(Object.assign(new Error('smtp down'), { code: 'ECONNECTION' }));
    expect((await cron(`Bearer ${SECRET}`)).body).toMatchObject({ sent: false, reason: 'send-failed' });
    expect(await SignInEvent.countDocuments({ digestedAt: null })).toBe(1);

    expect((await cron(`Bearer ${SECRET}`)).body).toMatchObject({ sent: true, count: 1 });
  });
});
