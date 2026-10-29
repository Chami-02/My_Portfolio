// PF-124 — change password in Settings: the current password + a code
// emailed to the address this login used.
//
// Through the real routes, controller, models and mailer; only nodemailer's
// network call and the Have I Been Pwned lookup are mocked (as in the PF-125
// suite). The code is read back from the mocked email.
jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));
jest.mock('../services/breachedPasswords', () => ({ isBreached: jest.fn() }));

const request    = require('supertest');
const nodemailer = require('nodemailer');
const app        = require('../app');
const User           = require('../models/User');
const PasswordChange = require('../models/PasswordChange');
const PasswordReset  = require('../models/PasswordReset');
const { isBreached } = require('../services/breachedPasswords');
const { issueSession, isFamilyLive } = require('../services/sessionService');
const { MAX_ATTEMPTS } = require('../services/passwordCodes');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

const ORIGINAL = { ...process.env };
const PRIMARY  = 'owner@example.com';
const ALIAS    = 'other@example.com';
const OLD      = 'Old-Password-123';
const NEW      = 'a long new pass phrase';
// PF-124 follow-up: strong passwords, so only the REUSE rule can refuse them.
const P1 = 'quiet orange window seat';
const P2 = 'tea leaf hill road';
const sendMail = jest.fn();

// changeLimiter (10) is live under test — each case gets its own IP.
let ip = 0;
const nextIp = () => `10.124.${Math.floor(++ip / 250)}.${ip % 250}`;

let user, me, other, from;

/** A signed-in session for the owner, as a login through `address` makes. */
const signIn = (address = PRIMARY) => issueSession(user, { signedInAs: address, signInMethod: 'password' });

const askCode = (body, session = me) =>
  request(app).post('/api/auth/password/change/code')
    .set('Authorization', `Bearer ${session.accessToken}`)
    .set('X-Forwarded-For', from)
    .send(body);
const change = (body, session = me) =>
  request(app).post('/api/auth/password/change')
    .set('Authorization', `Bearer ${session.accessToken}`)
    .set('X-Forwarded-For', from)
    .send(body);

const familyOf = (session) =>
  JSON.parse(Buffer.from(session.accessToken.split('.')[1], 'base64url').toString()).fam;

/** Ask for a code and read it out of the email, as the owner would. */
const codeFor = async (session = me) => {
  const before = sendMail.mock.calls.length;
  const res = await askCode({ currentPassword: OLD, password: NEW }, session);
  expect(res.status).toBe(200);
  await eventually(() => sendMail.mock.calls.length > before);   // sent in the background
  return sendMail.mock.calls.at(-1)[0].text.match(/\b(\d{6})\b/)[1];
};
const wrongOf = (code) => (code === '000000' ? '111111' : '000000');

/** Recreate the owner with `password` as the current one, and sign in again. */
const ownerWith = async (password) => {
  await User.deleteMany({});
  user = await User.create({ email: PRIMARY, loginEmails: [ALIAS], password });
  me   = await signIn();
};

const signsIn = async (password) =>
  (await User.findOne({}).select('+password')).matchPassword(password);

/** Polls until `check()` is truthy — the alert is sent in the background. */
const eventually = async (check, ms = 3000) => {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) throw new Error('condition never became true');
    await new Promise((r) => setTimeout(r, 20));
  }
};
const changedMail = () => eventually(() =>
  sendMail.mock.calls.map(([m]) => m).find((m) => /was changed/.test(m.subject)));

let error;

beforeAll(connectTestDB);
beforeEach(async () => {
  process.env.GMAIL_USER = PRIMARY;
  process.env.GMAIL_APP_PASSWORD = 'abcdabcdabcdabcd';
  sendMail.mockReset().mockResolvedValue({ messageId: 'x' });
  nodemailer.createTransport.mockReset().mockReturnValue({ sendMail });
  isBreached.mockReset().mockResolvedValue(false);
  error = jest.spyOn(console, 'error').mockImplementation(() => {});
  user  = await User.create({ email: PRIMARY, loginEmails: [ALIAS], password: OLD });
  me    = await signIn();
  other = await signIn();
  from  = nextIp();
});
afterEach(async () => {
  process.env = { ...ORIGINAL };
  error.mockRestore();
  await clearDB();
});
afterAll(disconnectTestDB);

describe('POST /api/auth/password/change/code', () => {
  it('emails a code to the address this login used — the MAIN one', async () => {
    const res = await askCode({ currentPassword: OLD, password: NEW });
    expect(res.status).toBe(200);
    expect(res.body.sentTo).toBe(PRIMARY);
    const mail = (await eventually(() => sendMail.mock.calls.at(-1)))[0];
    expect(mail.to).toBe(PRIMARY);
    expect(mail.subject).toMatch(/^Your admin password change code: \d{6}$/);
    expect(mail.html).toContain('SECURITY CODE');
  });

  it('emails the SECOND address when this login used it', async () => {
    const res = await askCode({ currentPassword: OLD, password: NEW }, await signIn(ALIAS));
    expect(res.body.sentTo).toBe(ALIAS);
    expect((await eventually(() => sendMail.mock.calls.at(-1)))[0].to).toBe(ALIAS);
  });

  it('refuses a wrong current password with 400 — never 401 — and the session lives on', async () => {
    const res = await askCode({ currentPassword: 'not-the-password', password: NEW });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Your current password is wrong.');
    // The send can only start once a code row exists — so no row, no email.
    expect(await PasswordChange.countDocuments()).toBe(0);
    expect(sendMail).not.toHaveBeenCalled();
    expect(await isFamilyLive(familyOf(me))).toBe(true);
  });

  it('refuses a new password under 15 characters, before any email', async () => {
    const res = await askCode({ currentPassword: OLD, password: 'fourteen-chars' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/at least 15/);
    // The send can only start once a code row exists — so no row, no email.
    expect(await PasswordChange.countDocuments()).toBe(0);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('refuses a new password equal to the current one (reuse)', async () => {
    await ownerWith(P1);
    const res = await askCode({ currentPassword: P1, password: P1 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/used this password recently.*last 5/);
    // The send can only start once a code row exists — so no row, no email.
    expect(await PasswordChange.countDocuments()).toBe(0);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('refuses one of the passwords BEFORE the current one (history)', async () => {
    await ownerWith(P1);
    const first = await askCode({ currentPassword: P1, password: P2 });
    expect(first.status).toBe(200);
    await eventually(() => sendMail.mock.calls.length > 0);
    const code = sendMail.mock.calls.at(-1)[0].text.match(/\b(\d{6})\b/)[1];
    expect((await change({ code })).status).toBe(200);   // P1 → P2

    from = nextIp();
    const back = await askCode({ currentPassword: P2, password: P1 });
    expect(back.status).toBe(400);
    expect(back.body.message).toMatch(/used this password recently/);
  });

  it("refuses a password built from the account's own address name", async () => {
    const res = await askCode({ currentPassword: OLD, password: 'owner sunset lamp river' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/your name, your email address or the site's name/);
    // The send can only start once a code row exists — so no row, no email.
    expect(await PasswordChange.countDocuments()).toBe(0);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("refuses an easy-to-guess password with zxcvbn's reason", async () => {
    const res = await askCode({ currentPassword: OLD, password: 'qwertyuiopasdfg' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/commonly used password|easy to guess/);
  });

  it('refuses a leaked password before any email', async () => {
    isBreached.mockResolvedValueOnce(true);
    const res = await askCode({ currentPassword: OLD, password: P2 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/data leak/);
    // The send can only start once a code row exists — so no row, no email.
    expect(await PasswordChange.countDocuments()).toBe(0);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('says so with 503 when mail is not configured', async () => {
    delete process.env.GMAIL_APP_PASSWORD;
    const res = await askCode({ currentPassword: OLD, password: NEW });
    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/admin:password/);
    expect(await PasswordChange.countDocuments()).toBe(0);
  });

  it('sends at most one code a minute — the second ask is a 429', async () => {
    await codeFor();
    const again = await askCode({ currentPassword: OLD, password: NEW });
    expect(again.status).toBe(429);
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('answers BEFORE the email is sent — the send runs in the background', async () => {
    let release;
    sendMail.mockImplementationOnce(() => new Promise((r) => { release = r; }));
    const res = await askCode({ currentPassword: OLD, password: NEW });
    expect(res.status).toBe(200);              // answered while the send still hangs
    await eventually(() => sendMail.mock.calls.length === 1);
    release({ messageId: 'x' });
  });

  it('a failed background send deletes the code, so RESEND works at once', async () => {
    sendMail.mockRejectedValueOnce(Object.assign(new Error('boom'), { code: 'EAUTH' }));
    expect((await askCode({ currentPassword: OLD, password: NEW })).status).toBe(200);
    await eventually(async () => (await PasswordChange.countDocuments()) === 0);
    expect((await askCode({ currentPassword: OLD, password: NEW })).status).toBe(200);
  });

  it('keeps only a bcrypt HASH of the new password beside the code — never the text', async () => {
    await codeFor();
    const row = await PasswordChange.findOne({}).lean();
    expect(row.pendingHash).toMatch(/^\$2[aby]\$12\$/);
    expect(JSON.stringify(row)).not.toContain(NEW);
    expect(row.family).toBe(familyOf(me));
  });

  it('needs a signed-in session (401 without one)', async () => {
    const res = await request(app).post('/api/auth/password/change/code')
      .send({ currentPassword: OLD, password: NEW });
    expect(res.status).toBe(401);
  });

  it.each([
    ['an array current password', { currentPassword: [OLD], password: NEW }],
    ['an empty current password', { currentPassword: '',    password: NEW }],
    ['an array new password',     { currentPassword: OLD,   password: [NEW] }],
  ])('refuses %s with 400', async (_name, body) => {
    expect((await askCode(body)).status).toBe(400);
    // The send can only start once a code row exists — so no row, no email.
    expect(await PasswordChange.countDocuments()).toBe(0);
    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/password/change', () => {
  it('changes the password; THIS device stays signed in, every other one is signed out', async () => {
    const code = await codeFor();
    const res  = await change({ code });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/Every other device was signed out/);
    expect(await signsIn(NEW)).toBe(true);
    expect(await signsIn(OLD)).toBe(false);
    expect(await isFamilyLive(familyOf(me))).toBe(true);
    expect(await isFamilyLive(familyOf(other))).toBe(false);
    // This device's token still works on a protected route.
    const meRes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${me.accessToken}`);
    expect(meRes.status).toBe(200);
  });

  it('alerts the main address only, after a change signed in with it', async () => {
    const code = await codeFor();
    await change({ code });
    const mail = await changedMail();
    expect(mail.to).toEqual([PRIMARY]);
    expect(mail.subject).toBe('Your admin password was changed in Settings');
    expect(mail.html).toContain('SECURITY ALERT');
  });

  it('alerts the SECOND address AND the main one, after a change signed in with the second', async () => {
    const alias = await signIn(ALIAS);
    const code  = await codeFor(alias);
    await change({ code }, alias);
    const mail = await changedMail();
    expect(mail.to).toEqual([PRIMARY, ALIAS]);
    expect(mail.text).toContain(`signed in as ${ALIAS}`);
  });

  it('a code works ONCE', async () => {
    const code = await codeFor();
    expect((await change({ code })).status).toBe(200);
    const again = await change({ code });
    expect(again.status).toBe(400);
    expect(await signsIn(NEW)).toBe(true);
  });

  it(`a code dies after ${MAX_ATTEMPTS} wrong guesses — even the right one then fails`, async () => {
    const code = await codeFor();
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      from = nextIp();   // past the per-IP limiter: the cap is per CODE
      expect((await change({ code: wrongOf(code) })).status).toBe(400);
    }
    expect((await change({ code })).status).toBe(400);
    expect(await signsIn(OLD)).toBe(true);
  });

  it(`${MAX_ATTEMPTS - 1} wrong guesses still leave the right code working`, async () => {
    const code = await codeFor();
    for (let i = 0; i < MAX_ATTEMPTS - 1; i += 1) {
      await change({ code: wrongOf(code) });
    }
    expect((await change({ code })).status).toBe(200);
  });

  it('another signed-in device of the same account cannot spend the code', async () => {
    const code = await codeFor(me);
    const res  = await change({ code }, other);   // same address, other session
    expect(res.status).toBe(400);
    expect(await signsIn(OLD)).toBe(true);
  });

  it('a password change by another door while a change is pending voids the code', async () => {
    const code = await codeFor();
    const u = await User.findById(user._id).select('+password +passwordHistory');
    u.setPassword(P2);
    await u.save();
    const { dropAllCodes } = require('../services/passwordCodes');
    await dropAllCodes(user._id);   // what every door does after a change
    expect((await change({ code })).status).toBe(400);
    expect(await signsIn(P2)).toBe(true);
  });

  it('step two needs nothing but the code, and sets the password step one checked', async () => {
    const code = await codeFor();
    expect((await change({ code })).status).toBe(200);
    expect(await signsIn(NEW)).toBe(true);
    const u = await User.findOne({}).select('+passwordHistory');
    expect(u.passwordHistory).toHaveLength(1);   // the old one, kept for reuse
  });

  it('an expired code is refused', async () => {
    const code = await codeFor();
    await PasswordChange.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });
    expect((await change({ code })).status).toBe(400);
    expect(await signsIn(OLD)).toBe(true);
  });

  it('a code sent to one address is refused from a login through the other', async () => {
    const code = await codeFor(me);   // sent to PRIMARY
    const res  = await change({ code }, await signIn(ALIAS));
    expect(res.status).toBe(400);
    expect(await signsIn(OLD)).toBe(true);
  });


  describe('the change code and the forgot-password code never mix', () => {
    it('a CHANGE code does not work on the public reset page', async () => {
      const code = await codeFor();
      const res  = await request(app).post('/api/auth/password/reset')
        .set('X-Forwarded-For', nextIp())
        .send({ email: PRIMARY, code, password: NEW });
      expect(res.status).toBe(400);
      expect(await signsIn(OLD)).toBe(true);
    });

    it('a pending RESET code does not work here', async () => {
      const { issueCode } = require('../services/passwordCodes');
      const code = await issueCode(PasswordReset, user._id, PRIMARY);
      expect((await change({ code })).status).toBe(400);
      expect(await signsIn(OLD)).toBe(true);
    });

    it('a completed RESET voids a pending change code (through the real reset)', async () => {
      const changeCode = await codeFor();
      await request(app).post('/api/auth/password/forgot').set('X-Forwarded-For', nextIp()).send({ email: PRIMARY });
      const resetMail = await eventually(() => sendMail.mock.calls.map(([m]) => m).find((m) => /reset code/.test(m.subject)));
      const resetCode = resetMail.text.match(/\b(\d{6})\b/)[1];
      const reset = await request(app).post('/api/auth/password/reset').set('X-Forwarded-For', nextIp())
        .send({ email: PRIMARY, code: resetCode, password: P2 });
      expect(reset.status).toBe(200);
      // Asserted on the ROW: trying the code from a new session would be refused
      // anyway (a new session family), voided or not — a mutant proved it.
      expect(await PasswordChange.countDocuments()).toBe(0);
      expect(changeCode).toMatch(/^\d{6}$/);
      expect(await signsIn(P2)).toBe(true);
    });

    it('a completed CHANGE voids a pending reset code', async () => {
      await request(app).post('/api/auth/password/forgot').set('X-Forwarded-For', nextIp()).send({ email: PRIMARY });
      await eventually(() => PasswordReset.exists({}));
      const code = await codeFor();
      expect((await change({ code })).status).toBe(200);
      expect(await PasswordReset.countDocuments()).toBe(0);
    });

    it('a public forgot request leaves a pending change code alone', async () => {
      const code = await codeFor();
      await request(app).post('/api/auth/password/forgot')
        .set('X-Forwarded-For', nextIp()).send({ email: PRIMARY });
      await eventually(() => PasswordReset.exists({}));
      expect((await change({ code })).status).toBe(200);
    });
  });

  it.each([
    ['an array code',     { code: ['123456'] }],
    ['a 5-digit code',    { code: '12345' }],
    ['no code',           {}],
  ])('refuses %s with 400', async (_name, body) => {
    expect((await change(body)).status).toBe(400);
    expect(await signsIn(OLD)).toBe(true);
  });

  it('is rate limited per IP across both routes (10 per 15 minutes)', async () => {
    for (let i = 0; i < 5; i += 1) {
      expect((await askCode({ currentPassword: 'wrong-guess', password: NEW })).status).toBe(400);
      expect((await change({ code: '000000' })).status).toBe(400);
    }
    expect((await askCode({ currentPassword: OLD, password: NEW })).status).toBe(429);
  });
});
