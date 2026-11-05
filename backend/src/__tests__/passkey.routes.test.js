// PF-140 — passkeys. Through the real routes, controllers, models and the real
// WebAuthn library, signed by a real key in software (helpers/softAuthenticator).
// Only nodemailer's transport is replaced (the network edge).
jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

const request     = require('supertest');
const nodemailer  = require('nodemailer');
const mongoose    = require('mongoose');
const app         = require('../app');
const User        = require('../models/User');
const Session     = require('../models/Session');
const Passkey     = require('../models/Passkey');
const PasskeyChallenge = require('../models/PasskeyChallenge');
const SignInEvent = require('../models/SignInEvent');
const { issueSession, rotateSession } = require('../services/sessionService');
const { MAX_PASSKEYS } = require('../controllers/passkeyController');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');
const { OUR_ORIGIN, asOurSite, setCookieLine, refreshCookieOf } = require('./helpers/refreshCookie');
const { createAuthenticator } = require('./helpers/softAuthenticator');

const PRIMARY  = 'owner@example.com';
const ALIAS    = 'second@example.com';
const PASSWORD = 'Owner-Password-140';
const RP_ID    = 'localhost';
const CHROME_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const ORIGINAL = { ...process.env };
const sendMail = jest.fn();

// The limiters are live under test — each case gets its own address.
let ip = 0;
const nextIp = () => `10.140.${Math.floor(++ip / 250)}.${ip % 250}`;

let user, me, from, warn;

const eventually = async (check, ms = 3000) => {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) throw new Error('condition never became true');
    await new Promise((r) => setTimeout(r, 20));
  }
};
const settle = () => new Promise((r) => setTimeout(r, 300));

const signedIn = (req, session = me) =>
  req.set('Authorization', `Bearer ${session.accessToken}`).set('X-Forwarded-For', from).set('User-Agent', CHROME_MAC);

const registerOptions = (password = PASSWORD, session = me) =>
  signedIn(request(app).post('/api/auth/passkey/register/options'), session).send({ password });
const registerVerify = (credential, session = me) =>
  signedIn(request(app).post('/api/auth/passkey/register/verify'), session).send({ credential });
const list = (session = me) => signedIn(request(app).get('/api/auth/passkeys'), session);
const remove = (id, password = PASSWORD, session = me) =>
  signedIn(request(app).post('/api/auth/passkeys/remove'), session).send({ id, password });

/** Options → the device → verify, the way the Settings card does it. */
const addPasskey = async (device = createAuthenticator(), overrides = {}) => {
  const { body } = await registerOptions();
  const res = await registerVerify(device.register({
    challenge: body.options.challenge, origin: OUR_ORIGIN, rpId: RP_ID, ...overrides,
  }));
  return { device, res };
};

const loginOptions = () =>
  asOurSite(request(app).post('/api/auth/passkey/login/options')).set('X-Forwarded-For', from).set('User-Agent', CHROME_MAC);
const loginVerify = (credential, cookie) => {
  const req = asOurSite(request(app).post('/api/auth/passkey/login/verify'))
    .set('X-Forwarded-For', from).set('User-Agent', CHROME_MAC);
  return (cookie ? req.set('Cookie', cookie) : req).send(credential);
};
const flowCookie = (res) => setCookieLine(res, 'pf_passkey')?.split(';')[0];

/** Options → the device → verify, the way the sign-in page does it. */
const signIn = async (device, overrides = {}) => {
  const options = await loginOptions();
  return loginVerify(device.signIn({
    challenge: options.body.options.challenge, origin: OUR_ORIGIN, rpId: RP_ID, ...overrides,
  }), flowCookie(options));
};

const events = (filter = {}) => SignInEvent.find(filter).sort({ createdAt: 1, _id: 1 }).lean();
const mails = (subject) => sendMail.mock.calls.map(([m]) => m).filter((m) => subject.test(m.subject));

beforeAll(connectTestDB);
beforeEach(async () => {
  process.env.FRONTEND_URL = OUR_ORIGIN;
  process.env.RESEND_API_KEY = 're_test_key';
  sendMail.mockReset().mockResolvedValue({ messageId: 'x' });
  nodemailer.createTransport.mockReset().mockReturnValue({ sendMail });
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  user = await User.create({ email: PRIMARY, loginEmails: [ALIAS], password: PASSWORD });
  me   = await issueSession(user, { signedInAs: ALIAS, signInMethod: 'password', device: 'Chrome on macOS' });
  from = nextIp();
});
afterEach(async () => {
  await settle();                 // let background work finish before the wipe
  process.env = { ...ORIGINAL };
  jest.restoreAllMocks();
  await clearDB();
});
afterAll(disconnectTestDB);

describe('adding a passkey', () => {
  it('stores the PUBLIC key and answers with no key material', async () => {
    const { device, res } = await addPasskey();

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ label: 'Chrome on macOS', synced: true, lastUsedAt: null });
    expect(res.body.data.publicKey).toBeUndefined();
    expect(res.body.data.credentialId).toBeUndefined();

    const [row] = await Passkey.find();
    expect(row.user).toEqual(user._id);
    expect(row.credentialId).toBe(device.credentialId);
    expect(row.publicKey.length).toBeGreaterThan(0);
  });

  it('records a device that cannot sync as not synced', async () => {
    const { res } = await addPasskey(createAuthenticator({ synced: false }));
    expect(res.body.data.synced).toBe(false);
  });

  it('asks the device for a passkey that names its account and checks the person', async () => {
    const { body } = await registerOptions();
    expect(body.options.authenticatorSelection).toMatchObject({ residentKey: 'required', userVerification: 'required' });
    expect(body.options.attestation).toBe('none');
    expect(body.options.rp.id).toBe(RP_ID);
    expect(body.options.timeout).toBe(300000);
    // The handle is the opaque account id, never an address.
    expect(Buffer.from(body.options.user.id, 'base64url').toString()).toBe(String(user._id));
    expect(body.options.user.id).not.toContain(Buffer.from(PRIMARY).toString('base64url'));
  });

  it('tells the device which passkeys it must not make twice', async () => {
    const { device } = await addPasskey();
    const { body } = await registerOptions();
    expect(body.options.excludeCredentials.map((c) => c.id)).toEqual([device.credentialId]);
  });

  it('needs a session', async () => {
    expect((await request(app).post('/api/auth/passkey/register/options').send({ password: PASSWORD })).status).toBe(401);
    expect((await request(app).post('/api/auth/passkey/register/verify').send({ credential: { id: 'x' } })).status).toBe(401);
    expect((await request(app).get('/api/auth/passkeys')).status).toBe(401);
    expect((await request(app).post('/api/auth/passkeys/remove').send({ id: 'x', password: PASSWORD })).status).toBe(401);
  });

  it('a wrong password is 400, never 401, gets no challenge, and is logged', async () => {
    const res = await registerOptions('not-the-password');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Your password is wrong.');
    expect(res.body.options).toBeUndefined();
    expect(await PasskeyChallenge.countDocuments()).toBe(0);
    expect(await events({ kind: 'passkey-add' })).toMatchObject([{ outcome: 'failed', address: PRIMARY }]);
  });

  it.each([
    ['a fake site', { origin: 'https://parindragallage-login.com' }],
    ['another domain name', { rpId: 'evil.example' }],
    ['no check of the person', { userVerified: false }],
    ['a made-up challenge', { challenge: Buffer.from('made-up-challenge-made-up').toString('base64url') }],
  ])('refuses %s, and stores nothing', async (_name, overrides) => {
    const { res } = await addPasskey(createAuthenticator(), overrides);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("We couldn't add that passkey. Please try again.");
    expect(await Passkey.countDocuments()).toBe(0);
    expect(await events({ kind: 'passkey-add', outcome: 'ok' })).toHaveLength(0);
  });

  it('a challenge from another session of the same account does not work', async () => {
    const other = await issueSession(user, { signInMethod: 'password' });
    const { body } = await registerOptions(PASSWORD, other);
    const res = await registerVerify(createAuthenticator().register({
      challenge: body.options.challenge, origin: OUR_ORIGIN, rpId: RP_ID,
    }), me);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('That took too long. Please try again.');
    expect(await Passkey.countDocuments()).toBe(0);
  });

  it('a challenge works once', async () => {
    const device = createAuthenticator();
    const { body } = await registerOptions();
    const answer = device.register({ challenge: body.options.challenge, origin: OUR_ORIGIN, rpId: RP_ID });
    expect((await registerVerify(answer)).status).toBe(201);

    // A DIFFERENT device: the same answer again would be refused as a duplicate
    // whether or not the challenge had been spent.
    const second = await registerVerify(createAuthenticator().register({
      challenge: body.options.challenge, origin: OUR_ORIGIN, rpId: RP_ID,
    }));
    expect(second.status).toBe(400);
    expect(second.body.message).toBe('That took too long. Please try again.');
    expect(await Passkey.countDocuments()).toBe(1);
  });

  it('a second press replaces the first attempt: only the newest challenge works', async () => {
    const first  = await registerOptions();
    const second = await registerOptions();
    expect(await PasskeyChallenge.countDocuments({ purpose: 'register' })).toBe(1);

    const stale = await registerVerify(createAuthenticator().register({
      challenge: first.body.options.challenge, origin: OUR_ORIGIN, rpId: RP_ID,
    }));
    expect(stale.status).toBe(400);

    const again = await registerOptions();
    expect(again.body.options.challenge).not.toBe(second.body.options.challenge);
    const fresh = await registerVerify(createAuthenticator().register({
      challenge: again.body.options.challenge, origin: OUR_ORIGIN, rpId: RP_ID,
    }));
    expect(fresh.status).toBe(201);
  });

  it('an expired challenge is refused even while its row still exists', async () => {
    const { body } = await registerOptions();
    await PasskeyChallenge.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await registerVerify(createAuthenticator().register({
      challenge: body.options.challenge, origin: OUR_ORIGIN, rpId: RP_ID,
    }));
    expect(res.status).toBe(400);
    expect(await Passkey.countDocuments()).toBe(0);
  });

  it('stops at the cap, and the last one under the cap is still allowed', async () => {
    const rows = (n) => Array.from({ length: n }, (_, i) => ({
      user: user._id, credentialId: `cap-${i}`, publicKey: Buffer.from('x'),
    }));
    await Passkey.create(rows(MAX_PASSKEYS - 1));
    expect((await registerOptions()).status).toBe(200);

    await Passkey.create({ user: user._id, credentialId: 'cap-last', publicKey: Buffer.from('x') });
    const res = await registerOptions();
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(`You already have ${MAX_PASSKEYS} passkeys. Remove one first.`);
  });

  it.each([[['an', 'array']], ['text'], [null], [{ id: '' }], [{ id: { $ne: 'x' } }]])(
    'refuses a credential of the wrong shape (%j)', async (credential) => {
      await registerOptions();
      expect((await registerVerify(credential)).status).toBe(400);
    },
  );

  it('logs it and emails the MAIN address and the one used', async () => {
    await addPasskey();
    expect(await events({ kind: 'passkey-add' })).toMatchObject([{ outcome: 'ok', address: PRIMARY }]);

    const [mail] = await eventually(() => mails(/passkey was added/).length === 1 && mails(/passkey was added/));
    expect(mail.to).toEqual([PRIMARY, ALIAS]);
    expect(mail.text).toContain('Chrome on macOS');
    expect(mail.text).toContain("Remove any passkey you don't recognise: Settings → Passkeys.");
  });

  it('a failed email does not fail the add', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    sendMail.mockRejectedValue(new Error('smtp down'));
    const { res } = await addPasskey();
    expect(res.status).toBe(201);
    expect(await Passkey.countDocuments()).toBe(1);
  });

  it('is refused when the site address is not configured', async () => {
    delete process.env.FRONTEND_URL;
    const res = await registerOptions();
    expect(res.status).toBe(503);
    expect(await PasskeyChallenge.countDocuments()).toBe(0);
  });
});

describe('signing in with a passkey', () => {
  let device;
  beforeEach(async () => { ({ device } = await addPasskey()); sendMail.mockClear(); });

  it('starts the SAME session as every other door: cookie set, no refresh token in the body', async () => {
    const res = await signIn(device);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toBeUndefined();
    expect(res.body.data.email).toBe(PRIMARY);
    expect(setCookieLine(res)).toMatch(/HttpOnly/);
    expect(setCookieLine(res)).toMatch(/SameSite=Strict/);

    const session = await Session.findOne({ signInMethod: 'passkey' });
    expect(session).toMatchObject({ signedInAs: PRIMARY, device: 'Chrome on macOS' });

    const me2 = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.accessToken}`);
    expect(me2.body.data).toMatchObject({ signedInAs: PRIMARY, signedInWith: 'passkey', passkey: true });
  });

  it('a rotation keeps "passkey" on the session', async () => {
    const res = await signIn(device);
    await rotateSession(refreshCookieOf(res));
    // The old row and its successor; `me` signed in with a password and is untouched.
    expect(await Session.countDocuments({ signInMethod: 'passkey' })).toBe(2);
    expect(await Session.countDocuments({ signInMethod: 'passkey', revokedAt: null })).toBe(1);
  });

  it('asks for no address: an empty allow-list and the person checked', async () => {
    const { body } = await loginOptions();
    expect(body.options.allowCredentials ?? []).toEqual([]);
    expect(body.options.userVerification).toBe('required');
    expect(body.options.rpId).toBe(RP_ID);
    expect(Buffer.from(body.options.challenge, 'base64url').length).toBeGreaterThanOrEqual(16);
  });

  it('the attempt cookie is httpOnly, Strict and only for these routes', async () => {
    const line = setCookieLine(await loginOptions(), 'pf_passkey');
    expect(line).toMatch(/HttpOnly/);
    expect(line).toMatch(/SameSite=Strict/);
    expect(line).toMatch(/Path=\/api\/auth\/passkey\/login/);
    expect(line).toMatch(/Max-Age=600/);
  });

  it('stores only a hash of the attempt cookie', async () => {
    const cookie = flowCookie(await loginOptions());
    const [row] = await PasskeyChallenge.find({ purpose: 'login' });
    expect(row.bindingHash).toBeDefined();
    expect(row.bindingHash).not.toBe(cookie.split('=')[1]);
  });

  it('updates the last-used date and the counter', async () => {
    await signIn(device, { counter: 5 });
    const [row] = await Passkey.find();
    expect(row.counter).toBe(5);
    expect(row.lastUsedAt).toBeInstanceOf(Date);
  });

  it('logs it, and the new-device email says "Passkey"', async () => {
    await signIn(device);
    expect(await events({ kind: 'sign-in' })).toMatchObject([{ outcome: 'ok', method: 'passkey', address: PRIMARY }]);
    const [mail] = await eventually(() => mails(/New sign-in/).length === 1 && mails(/New sign-in/));
    expect(mail.html).toContain('Passkey');
    expect(mail.text).toMatch(/Method:? *Passkey/);
    expect(mail.text).not.toMatch(/Method:? *Password/);
  });

  it.each([
    ['a fake site', { origin: 'https://parindragallage-login.com' }],
    ['another domain name', { rpId: 'evil.example' }],
    ['no check of the person', { userVerified: false }],
  ])('refuses %s, starts no session, and logs a failure', async (_name, overrides) => {
    const res = await signIn(device, overrides);
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("We couldn't sign you in with that passkey. Please try again, or use your password or Google.");
    expect(res.body.accessToken).toBeUndefined();
    expect(setCookieLine(res)).toBeUndefined();
    expect(await Session.countDocuments({ signInMethod: 'passkey' })).toBe(0);
    // No account on the row: an answer that failed proves nothing about whose it was.
    expect(await events({ kind: 'sign-in' })).toMatchObject([{ outcome: 'failed', method: 'passkey', user: null }]);
  });

  it('refuses a signature made by a different key under this passkey\'s id', async () => {
    const thief = createAuthenticator();
    const options = await loginOptions();
    const answer = thief.signIn({ challenge: options.body.options.challenge, origin: OUR_ORIGIN, rpId: RP_ID });
    answer.id = device.credentialId;
    answer.rawId = device.credentialId;
    expect((await loginVerify(answer, flowCookie(options))).status).toBe(401);
    expect(await Session.countDocuments({ signInMethod: 'passkey' })).toBe(0);
  });

  it('refuses an unknown passkey and logs it with no account', async () => {
    const res = await signIn(createAuthenticator());
    expect(res.status).toBe(401);
    expect(await events({ kind: 'sign-in' })).toMatchObject([{ outcome: 'failed', method: 'passkey', user: null }]);
  });

  it('refuses a signed answer replayed against a new challenge', async () => {
    const first = await loginOptions();
    const answer = device.signIn({ challenge: first.body.options.challenge, origin: OUR_ORIGIN, rpId: RP_ID });
    expect((await loginVerify(answer, flowCookie(first))).status).toBe(200);

    const second = await loginOptions();
    expect((await loginVerify(answer, flowCookie(second))).status).toBe(401);
    expect(await Session.countDocuments({ signInMethod: 'passkey' })).toBe(1);
  });

  it('a challenge works once, even when the first try was wrong', async () => {
    const options = await loginOptions();
    const cookie = flowCookie(options);
    const { challenge } = options.body.options;
    await loginVerify(device.signIn({ challenge, origin: 'https://fake.example', rpId: RP_ID }), cookie);

    const res = await loginVerify(device.signIn({ challenge, origin: OUR_ORIGIN, rpId: RP_ID }), cookie);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('That took too long. Please try again.');
  });

  it('an answer needs the browser that asked: no cookie, or another browser\'s, is refused', async () => {
    const asked = await loginOptions();
    const { challenge } = asked.body.options;
    const answer = device.signIn({ challenge, origin: OUR_ORIGIN, rpId: RP_ID });

    expect((await loginVerify(answer)).status).toBe(400);
    expect((await loginVerify(answer, 'pf_passkey=somebody-elses')).status).toBe(400);
    // Neither spent it: the browser that asked still gets in.
    expect((await loginVerify(answer, flowCookie(asked))).status).toBe(200);
  });

  it('another browser\'s live attempt does not stand in for this one', async () => {
    const mine = await loginOptions();
    const theirs = await loginOptions();
    const answer = device.signIn({ challenge: mine.body.options.challenge, origin: OUR_ORIGIN, rpId: RP_ID });
    expect((await loginVerify(answer, flowCookie(theirs))).status).toBe(401);
  });

  it('an expired challenge is refused even while its row still exists', async () => {
    const options = await loginOptions();
    await PasskeyChallenge.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await loginVerify(device.signIn({
      challenge: options.body.options.challenge, origin: OUR_ORIGIN, rpId: RP_ID,
    }), flowCookie(options));
    expect(res.status).toBe(400);
    expect(await Session.countDocuments({ signInMethod: 'passkey' })).toBe(0);
  });

  it('a counter going backwards is refused (a possible copy of the key)', async () => {
    expect((await signIn(device, { counter: 10 })).status).toBe(200);
    expect((await signIn(device, { counter: 9 })).status).toBe(401);
    expect((await signIn(device, { counter: 10 })).status).toBe(401);
    expect((await signIn(device, { counter: 11 })).status).toBe(200);
  });

  // The race made certain: another use lands between this one reading the
  // passkey and writing its counter. Two real parallel requests rarely overlap
  // there, so a test of those passes with the guard deleted.
  it('a use that lost the race for the counter is refused', async () => {
    const realFindOne = Passkey.findOne.bind(Passkey);
    jest.spyOn(Passkey, 'findOne').mockImplementationOnce(async (filter) => {
      const read = await realFindOne(filter);
      await Passkey.updateOne({ _id: read._id }, { $set: { counter: 3 } });
      return read;
    });

    expect((await signIn(device, { counter: 5 })).status).toBe(401);
    expect((await Passkey.findOne({ credentialId: device.credentialId })).counter).toBe(3);
    expect(await Session.countDocuments({ signInMethod: 'passkey' })).toBe(0);
  });

  it('a device that reports 0 every time keeps working', async () => {
    expect((await signIn(device, { counter: 0 })).status).toBe(200);
    expect((await signIn(device, { counter: 0 })).status).toBe(200);
  });

  it('checks the account the device names, when it names one', async () => {
    const right = Buffer.from(String(user._id)).toString('base64url');
    expect((await signIn(device, { userHandle: right })).status).toBe(200);

    const wrong = Buffer.from(String(new mongoose.Types.ObjectId())).toString('base64url');
    expect((await signIn(device, { userHandle: wrong })).status).toBe(401);
  });

  it('a passkey whose account is gone signs nobody in', async () => {
    await User.deleteOne({ _id: user._id });
    expect((await signIn(device)).status).toBe(401);
    expect(await Session.countDocuments({ signInMethod: 'passkey' })).toBe(0);
  });

  it.each([
    ['options', '/api/auth/passkey/login/options'],
    ['verify', '/api/auth/passkey/login/verify'],
  ])('%s refuses a request from another website', async (_name, path) => {
    // Not a foreign Origin: CORS answers that first, and this would pass with
    // `fromOurSite` deleted (Silent failures, PF-147). These two get past CORS.
    const crossSite = await request(app).post(path)
      .set('X-Forwarded-For', from).set('Origin', OUR_ORIGIN).set('Sec-Fetch-Site', 'cross-site').send({ id: 'x' });
    expect(crossSite.status).toBe(403);

    const noOrigin = await request(app).post(path)
      .set('X-Forwarded-For', from).send({ id: 'x' });
    expect(noOrigin.status).toBe(403);
  });

  it.each([[['an', 'array']], [{ id: { $ne: 'x' } }], [{ id: 5 }], [{}]])(
    'refuses a body of the wrong shape (%j) before any query', async (credential) => {
      const options = await loginOptions();
      expect((await loginVerify(credential, flowCookie(options))).status).toBe(400);
      expect(await events({ kind: 'sign-in' })).toHaveLength(0);
    },
  );

  it('is refused when the site address is not configured', async () => {
    delete process.env.FRONTEND_URL;
    expect((await loginOptions()).status).toBe(503);
  });

  it('never sends the public key or a counter to the sign-in page', async () => {
    const res = await signIn(device);
    expect(JSON.stringify(res.body)).not.toMatch(/publicKey|counter/);
  });
});

describe('listing passkeys', () => {
  it('newest first, with what the card shows and nothing else', async () => {
    const older = await addPasskey();
    await Passkey.updateOne({ credentialId: older.device.credentialId }, { $set: { createdAt: new Date('2026-01-01') } });
    await addPasskey();

    const { body } = await list();
    expect(body.data).toHaveLength(2);
    expect(new Date(body.data[0].addedAt).getTime()).toBeGreaterThan(new Date(body.data[1].addedAt).getTime());
    expect(Object.keys(body.data[0]).sort()).toEqual(['addedAt', 'id', 'label', 'lastUsedAt', 'synced']);
  });

  it('never shows another account\'s passkeys', async () => {
    const stranger = await User.create({ email: 'other@example.com', password: PASSWORD });
    await Passkey.create({ user: stranger._id, credentialId: 'theirs', publicKey: Buffer.from('x') });
    expect((await list()).body.data).toEqual([]);
  });
});

describe('removing a passkey', () => {
  it('deletes it, so it can no longer sign in', async () => {
    const { device, res } = await addPasskey();
    expect((await remove(res.body.data.id)).status).toBe(200);
    expect(await Passkey.countDocuments()).toBe(0);
    expect((await signIn(device)).status).toBe(401);
  });

  it('a wrong password is 400, never 401, removes nothing, and is logged', async () => {
    const { res } = await addPasskey();
    const refused = await remove(res.body.data.id, 'not-the-password');
    expect(refused.status).toBe(400);
    expect(refused.body.message).toBe('Your password is wrong.');
    expect(await Passkey.countDocuments()).toBe(1);
    expect(await events({ kind: 'passkey-remove' })).toMatchObject([{ outcome: 'failed' }]);
  });

  it('another account\'s passkey cannot be removed', async () => {
    const stranger = await User.create({ email: 'other@example.com', password: PASSWORD });
    const theirs = await Passkey.create({ user: stranger._id, credentialId: 'theirs', publicKey: Buffer.from('x') });
    expect((await remove(String(theirs._id))).status).toBe(404);
    expect(await Passkey.countDocuments({ _id: theirs._id })).toBe(1);
  });

  it.each([[{ $ne: 'x' }], [['a']], ['not-an-id'], ['']])(
    'an id of the wrong shape (%j) removes nothing', async (id) => {
      await addPasskey();
      const res = await remove(id);
      expect([400, 404]).toContain(res.status);
      expect(await Passkey.countDocuments()).toBe(1);
    },
  );

  it('an id that is already gone says so', async () => {
    const res = await remove(String(new mongoose.Types.ObjectId()));
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('That passkey has already been removed.');
  });

  it('logs it and emails the MAIN address and the one used', async () => {
    const { res } = await addPasskey();
    sendMail.mockClear();
    await remove(res.body.data.id);

    expect(await events({ kind: 'passkey-remove' })).toMatchObject([{ outcome: 'ok', address: PRIMARY }]);
    const [mail] = await eventually(() => mails(/passkey was removed/).length === 1 && mails(/passkey was removed/));
    expect(mail.to).toEqual([PRIMARY, ALIAS]);
  });

  it('signing in with a password still works once every passkey is gone', async () => {
    const { res } = await addPasskey();
    await remove(res.body.data.id);
    const login = await request(app).post('/api/auth/login')
      .set('X-Forwarded-For', nextIp()).send({ email: PRIMARY, password: PASSWORD });
    expect(login.status).toBe(200);
  });
});

describe('what other features say about passkeys', () => {
  it('/auth/me says false until one exists', async () => {
    const before = await signedIn(request(app).get('/api/auth/me'));
    expect(before.body.data.passkey).toBe(false);
    await addPasskey();
    const after = await signedIn(request(app).get('/api/auth/me'));
    expect(after.body.data.passkey).toBe(true);
  });

  it('a refused check logs a warning with no key material', async () => {
    const { device } = await addPasskey();
    await signIn(device, { origin: 'https://fake.example' });
    expect(warn).toHaveBeenCalled();
    expect(warn.mock.calls.flat().join(' ')).not.toMatch(/signature|BEGIN/i);
  });
});
