// PF-125 — forgot password: an emailed six-digit code, then a new password.
//
// Through the real routes, controller, model and mailer; only nodemailer's
// network call and the Have I Been Pwned lookup are mocked. The code is read
// back from the mocked email, exactly as the owner reads it from Gmail. The
// send runs in the background (waitUntil), so tests wait for its observable
// end — never a fixed sleep.
jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));
jest.mock('../services/breachedPasswords', () => ({ isBreached: jest.fn() }));

const request    = require('supertest');
const nodemailer = require('nodemailer');
const app        = require('../app');
const User          = require('../models/User');
const PasswordReset = require('../models/PasswordReset');
const { isBreached }   = require('../services/breachedPasswords');
const { issueSession, isFamilyLive } = require('../services/sessionService');
const Session = require('../models/Session');
const { MAX_ATTEMPTS } = require('../controllers/passwordResetController');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

const ORIGINAL = { ...process.env };
const PRIMARY  = 'owner@example.com';
const ALIAS    = 'other@example.com';
const OLD      = 'Old-Password-123';
const NEW      = 'a long new pass phrase';
// PF-124: strong enough to pass the strength check, so only REUSE refuses it.
const OLD_STRONG = 'quiet orange window seat';
const sendMail = jest.fn();

// forgotLimiter (5) and resetLimiter (10) are live under test — each case
// gets its own IP (`trust proxy 1` honours X-Forwarded-For).
let ip = 0;
const nextIp = () => `10.125.${Math.floor(++ip / 250)}.${ip % 250}`;
const forgot = (body, from = nextIp()) =>
  request(app).post('/api/auth/password/forgot').set('X-Forwarded-For', from).send(body);
const reset = (body, from = nextIp()) =>
  request(app).post('/api/auth/password/reset').set('X-Forwarded-For', from).send(body);

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

// For "nothing is sent": the background work cannot be awaited (waitUntil),
// and polling for the ABSENCE of a send is satisfied at once. So: wait a
// window that each test's CONTROL (a request that does send) shows is ample —
// a real send lands in a few ms — then assert. Mutation-tested.
const SETTLE_MS = 300;
const settle = () => new Promise((r) => setTimeout(r, SETTLE_MS));

/** Ask for a code and read it out of the email, as the owner would. */
const codeFor = async (email) => {
  const before = sendMail.mock.calls.length;
  await forgot({ email });
  await eventually(() => sendMail.mock.calls.length > before);
  const mail = sendMail.mock.calls.at(-1)[0];
  return mail.text.match(/\b(\d{6})\b/)[1];
};

const signsIn = async (password) =>
  (await User.findOne({}).select('+password')).matchPassword(password);

let warn, error;

beforeAll(connectTestDB);
beforeEach(async () => {
  process.env.GMAIL_USER = PRIMARY;
  process.env.GMAIL_APP_PASSWORD = 'abcdabcdabcdabcd';
  sendMail.mockReset().mockResolvedValue({ messageId: 'x' });
  nodemailer.createTransport.mockReset().mockReturnValue({ sendMail });
  isBreached.mockReset().mockResolvedValue(false);
  warn  = jest.spyOn(console, 'warn').mockImplementation(() => {});
  error = jest.spyOn(console, 'error').mockImplementation(() => {});
  await User.create({ email: PRIMARY, loginEmails: [ALIAS], password: OLD });
});
afterEach(async () => {
  process.env = { ...ORIGINAL };
  warn.mockRestore();
  error.mockRestore();
  await clearDB();
});
afterAll(disconnectTestDB);

describe('POST /api/auth/password/forgot', () => {
  it('answers a known and an unknown address IDENTICALLY', async () => {
    const known   = await forgot({ email: PRIMARY });
    const unknown = await forgot({ email: 'stranger@example.com' });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(unknown.body).toEqual(known.body);
  });

  it('emails a six-digit code to the address that asked — either login address', async () => {
    for (const address of [PRIMARY, ALIAS]) {
      await PasswordReset.deleteMany({});   // past the cooldown
      const before = sendMail.mock.calls.length;
      await forgot({ email: address.toUpperCase() });
      await eventually(() => sendMail.mock.calls.length > before);
      const mail = sendMail.mock.calls.at(-1)[0];
      expect(mail.to).toBe(address);
      expect(mail.text).toMatch(/\b\d{6}\b/);
      expect(mail.html).toMatch(/\b\d{6}\b/);
    }
  });

  it('sends nothing for an unknown address', async () => {
    await forgot({ email: 'stranger@example.com' });
    await settle();
    expect(sendMail).not.toHaveBeenCalled();
    expect(await PasswordReset.countDocuments()).toBe(0);
  });

  it('stores only a keyed hash of the code, never the code', async () => {
    const code = await codeFor(PRIMARY);
    const row  = await PasswordReset.findOne({}).lean();
    expect(JSON.stringify(row)).not.toContain(code);
    expect(row.codeHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('a second request within a minute sends no second email', async () => {
    await codeFor(PRIMARY);
    await forgot({ email: ALIAS });   // same account, other address
    await settle();
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('a new code cancels the old one', async () => {
    const first = await codeFor(PRIMARY);
    await PasswordReset.updateMany({}, { createdAt: new Date(Date.now() - 61_000) });
    const second = await codeFor(PRIMARY);
    expect(await PasswordReset.countDocuments()).toBe(1);

    if (first !== second) {
      const res = await reset({ email: PRIMARY, code: first, password: NEW });
      expect(res.status).toBe(400);
    }
    const ok = await reset({ email: PRIMARY, code: second, password: NEW });
    expect(ok.status).toBe(200);
  });

  it('still answers 200 with mail switched off, and logs why', async () => {
    process.env.GMAIL_APP_PASSWORD = '';
    const res = await forgot({ email: PRIMARY });
    expect(res.status).toBe(200);
    await eventually(() => warn.mock.calls.some(([m]) => /not configured/.test(m)));
    expect(sendMail).not.toHaveBeenCalled();
    expect(await PasswordReset.countDocuments()).toBe(0);
  });

  it('a failed send is logged, never thrown', async () => {
    sendMail.mockRejectedValueOnce(Object.assign(new Error('boom'), { code: 'EAUTH' }));
    const res = await forgot({ email: PRIMARY });
    expect(res.status).toBe(200);
    await eventually(() => error.mock.calls.some(([m]) => /EAUTH boom/.test(m)));
  });

  it.each([
    ['an array',  { email: [PRIMARY] }],
    ['an object', { email: { $ne: null } }],
    ['nothing',   {}],
  ])('refuses %s as the email with 400, and sends nothing', async (_name, body) => {
    const res = await forgot(body);
    expect(res.status).toBe(400);
    await settle();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('is rate limited per IP (5 per 15 minutes)', async () => {
    const from = nextIp();
    for (let i = 0; i < 5; i += 1) {
      expect((await forgot({ email: 'stranger@example.com' }, from)).status).toBe(200);
    }
    expect((await forgot({ email: 'stranger@example.com' }, from)).status).toBe(429);
  });
});

describe('POST /api/auth/password/reset', () => {
  it('the right code sets the new password (hashed) and the old one stops working', async () => {
    const code = await codeFor(PRIMARY);
    const res  = await reset({ email: PRIMARY, code, password: NEW });
    expect(res.status).toBe(200);
    expect(await signsIn(NEW)).toBe(true);
    expect(await signsIn(OLD)).toBe(false);
    const stored = (await User.findOne({}).select('+password')).password;
    expect(stored).not.toBe(NEW);
  });

  it('signs out every existing session, and signs nobody in', async () => {
    const user = await User.findOne({});
    const a = await issueSession(user);
    const familyOf = async (s) => (await Session.findById(s.sessionId)).family;
    const code = await codeFor(PRIMARY);

    const res = await reset({ email: PRIMARY, code, password: NEW });
    expect(res.body.accessToken).toBeUndefined();
    expect(res.body.refreshToken).toBeUndefined();
    expect(await isFamilyLive(await familyOf(a))).toBe(false);
  });

  const changedMail = () => eventually(() =>
    sendMail.mock.calls.map(([m]) => m).find((m) => /was changed/.test(m.subject)));

  it('a reset through the SECOND address alerts it AND the main address, naming it', async () => {
    const code = await codeFor(ALIAS);
    await reset({ email: ALIAS, code, password: NEW });
    const mail = await changedMail();
    expect(mail.to).toEqual([PRIMARY, ALIAS]);
    expect(mail.subject).toBe(`Your admin password was changed using ${ALIAS}`);
    expect(mail.text).toContain(`sent to ${ALIAS}`);
    expect(mail.html).toContain('SECURITY ALERT');
  });

  it('a reset through the MAIN address alerts the main address only', async () => {
    const code = await codeFor(PRIMARY);
    await reset({ email: PRIMARY, code, password: NEW });
    expect((await changedMail()).to).toEqual([PRIMARY]);
  });

  it('the code email uses the security template (branded, code highlighted)', async () => {
    await codeFor(PRIMARY);
    const mail = sendMail.mock.calls.at(-1)[0];
    expect(mail.html).toContain('SECURITY CODE');
    expect(mail.html).toContain('#14213D');   // the site's navy header
    expect(mail.text).toMatch(/expires in 10 minutes/);
  });

  it('a code works ONCE', async () => {
    const code = await codeFor(PRIMARY);
    expect((await reset({ email: PRIMARY, code, password: NEW })).status).toBe(200);
    const again = await reset({ email: PRIMARY, code, password: `${NEW} again` });
    expect(again.status).toBe(400);
    expect(await signsIn(NEW)).toBe(true);
  });

  it(`a code dies after ${MAX_ATTEMPTS} wrong guesses — even the right one then fails`, async () => {
    const code  = await codeFor(PRIMARY);
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      expect((await reset({ email: PRIMARY, code: wrong, password: NEW })).status).toBe(400);
    }
    expect((await reset({ email: PRIMARY, code, password: NEW })).status).toBe(400);
    expect(await signsIn(OLD)).toBe(true);
  });

  it(`${MAX_ATTEMPTS - 1} wrong guesses still leave the right code working`, async () => {
    const code  = await codeFor(PRIMARY);
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < MAX_ATTEMPTS - 1; i += 1) {
      await reset({ email: PRIMARY, code: wrong, password: NEW });
    }
    expect((await reset({ email: PRIMARY, code, password: NEW })).status).toBe(200);
  });

  it('an expired code is refused', async () => {
    const code = await codeFor(PRIMARY);
    await PasswordReset.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });
    expect((await reset({ email: PRIMARY, code, password: NEW })).status).toBe(400);
    expect(await signsIn(OLD)).toBe(true);
  });

  it('a code works only with the address it was sent to', async () => {
    const code = await codeFor(PRIMARY);
    expect((await reset({ email: ALIAS, code, password: NEW })).status).toBe(400);
    expect(await signsIn(OLD)).toBe(true);
  });

  it('gives ONE message for wrong, expired and unknown-address failures', async () => {
    const code = await codeFor(PRIMARY);
    const wrong   = await reset({ email: PRIMARY, code: code === '000000' ? '111111' : '000000', password: NEW });
    const unknown = await reset({ email: 'stranger@example.com', code, password: NEW });
    await PasswordReset.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });
    const expired = await reset({ email: PRIMARY, code, password: NEW });
    expect(unknown.body.message).toBe(wrong.body.message);
    expect(expired.body.message).toBe(wrong.body.message);
  });

  it('refuses a password under 15 characters — and spends no guess', async () => {
    const code = await codeFor(PRIMARY);
    const res  = await reset({ email: PRIMARY, code, password: 'fourteen-chars' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/at least 15/);
    expect((await PasswordReset.findOne({})).attempts).toBe(0);
    expect((await reset({ email: PRIMARY, code, password: NEW })).status).toBe(200);
  });

  it('refuses a password found in a data leak — and the code still works after', async () => {
    const code = await codeFor(PRIMARY);
    isBreached.mockResolvedValueOnce(true);
    // Strong enough for the strength check, so the LEAK check is what refuses.
    const res = await reset({ email: PRIMARY, code, password: 'tea leaf hill road' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/data leak/);
    expect((await reset({ email: PRIMARY, code, password: NEW })).status).toBe(200);
  });

  // ── PF-124: strength and reuse, after the code ────────────────────────────
  it('refuses a weak password only AFTER a right code — a wrong code says BAD_CODE', async () => {
    const code = await codeFor(PRIMARY);
    // "owner" is this account's own address name: refused for strength only
    // once the code proves the address. Before that, the reply must be the one
    // an unknown address gets, or it would tell a stranger the address is real.
    const wrong = await reset({ email: PRIMARY, code: code === '000000' ? '111111' : '000000', password: 'owner sunset lamp river' });
    expect(wrong.body.message).toMatch(/code is wrong/);
    const right = await reset({ email: PRIMARY, code, password: 'owner sunset lamp river' });
    expect(right.status).toBe(400);
    expect(right.body.message).toMatch(/your name, your email address/);
    expect((await reset({ email: PRIMARY, code, password: NEW })).status).toBe(200);   // code still alive
  });

  it('refuses the CURRENT password as the new one (reuse), code still alive', async () => {
    await User.deleteMany({});
    await User.create({ email: PRIMARY, loginEmails: [ALIAS], password: OLD_STRONG });
    const code = await codeFor(PRIMARY);
    const res  = await reset({ email: PRIMARY, code, password: OLD_STRONG });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/used this password recently/);
    expect((await reset({ email: PRIMARY, code, password: NEW })).status).toBe(200);
  });

  it('keeps the old password in the history', async () => {
    const code = await codeFor(PRIMARY);
    await reset({ email: PRIMARY, code, password: NEW });
    const user = await User.findOne({}).select('+password +passwordHistory');
    expect(user.passwordHistory).toHaveLength(1);
    expect(await user.usedRecently(OLD)).toBe(true);
  });

  it('a wrong code never reaches the leak check — no outbound call', async () => {
    const code = await codeFor(PRIMARY);
    await reset({ email: PRIMARY, code: code === '000000' ? '111111' : '000000', password: NEW });
    await reset({ email: 'stranger@example.com', code: '000000', password: NEW });
    expect(isBreached).not.toHaveBeenCalled();
  });

  it('accepts the password when the leak check could not run (fails open)', async () => {
    const code = await codeFor(PRIMARY);
    isBreached.mockResolvedValueOnce(null);
    expect((await reset({ email: PRIMARY, code, password: NEW })).status).toBe(200);
  });

  it.each([
    ['an array code',     { email: PRIMARY, code: ['123456'], password: NEW }],
    ['a 5-digit code',    { email: PRIMARY, code: '12345',    password: NEW }],
    ['an array password', { email: PRIMARY, code: '123456',   password: [NEW] }],
    ['an array email',    { email: [PRIMARY], code: '123456', password: NEW }],
  ])('refuses %s with 400', async (_name, body) => {
    expect((await reset(body)).status).toBe(400);
    expect(await signsIn(OLD)).toBe(true);
  });

  it('is rate limited per IP (10 per 15 minutes)', async () => {
    const from = nextIp();
    for (let i = 0; i < 10; i += 1) {
      expect((await reset({ email: PRIMARY, code: '000000', password: NEW }, from)).status).toBe(400);
    }
    expect((await reset({ email: PRIMARY, code: '000000', password: NEW }, from)).status).toBe(429);
  });
});
