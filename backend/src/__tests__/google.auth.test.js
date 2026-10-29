/**
 * PF-119 — Google sign-in: start → Google → callback → handoff → exchange.
 *
 * ⚠️ WHAT IS REAL AND WHAT IS NOT. Everything on our side of the wire runs
 * for real: the routes, the OAuthFlow rows, the cookie, the account binding,
 * `issueSession`, `protect`. AND the ID-token verification runs for real —
 * `verifyIdToken` checks the signature, `iss`, `aud` and `exp` exactly as in
 * production. The only seams are the two network calls Google would answer:
 *
 *   - Google's signing keys → a throwaway RSA key generated per run, put in
 *     the client's certificate cache (the same cache Google's response fills);
 *   - the code exchange (`getToken`) → returns an ID token WE signed with that
 *     key. Its claims are what each case varies.
 *
 * So a token with the wrong audience is refused by the library's own check,
 * not by a mock that was told to refuse it. What this cannot cover is Google's
 * consent screen itself — that is the owner's manual round trip.
 *
 * ⚠️ `googleLimiter` is live under test (30 / 15 min per IP) and one sign-in
 * costs three requests. Every case therefore signs in from its OWN client
 * address (`X-Forwarded-For`, honoured by `trust proxy 1`), so no case can
 * spend another's budget. The threshold itself is pinned in
 * googleLimiter.test.js.
 */
const crypto  = require('crypto');
const jwt     = require('jsonwebtoken');
const request = require('supertest');
const app     = require('../app');
const User      = require('../models/User');
const OAuthFlow = require('../models/OAuthFlow');
const SignInEvent = require('../models/SignInEvent');
const google    = require('../services/googleAuth');
const { safeReturnTo } = require('../controllers/authController');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

const ENV = {
  GOOGLE_CLIENT_ID:     'test-client-id.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
  GOOGLE_REDIRECT_URI:  'http://localhost:5050/api/auth/google/callback',
  FRONTEND_URL:         'http://localhost:5173',
};
const PRIMARY = 'pcgallege@gmail.com';
const SECOND  = 'parindrachameekara@gmail.com';
const ADMIN   = { email: PRIMARY, loginEmails: [SECOND], password: 'TestPass@1234!' };

const KID = 'test-key';
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const OTHER_KEY = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;

const saved = {};
let ip = 0;
const nextIp = () => `10.0.${Math.floor(ip / 250)}.${(ip++ % 250) + 1}`;

beforeAll(async () => {
  for (const [k, v] of Object.entries(ENV)) { saved[k] = process.env[k]; process.env[k] = v; }
  await connectTestDB();
});
beforeEach(() => {
  // The cache Google's JWKS response would fill — far-future expiry so the
  // library never tries the network.
  const client = google.getClient();
  client.certificateCache  = { [KID]: publicKey.export({ type: 'spki', format: 'pem' }) };
  client.certificateExpiry = new Date(Date.now() + 60 * 60 * 1000);
});
afterEach(async () => {
  jest.restoreAllMocks();
  await clearDB();
});
afterAll(async () => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
  await disconnectTestDB();
});

/** An ID token as Google would sign it; `over` replaces or (undefined) drops claims. */
const idToken = (over = {}, { key = privateKey, kid = KID } = {}) => {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: 'https://accounts.google.com',
    aud: ENV.GOOGLE_CLIENT_ID,
    sub: 'google-sub-primary',
    email: PRIMARY,
    email_verified: true,
    iat: now,
    exp: now + 3600,
    ...over,
  };
  for (const k of Object.keys(claims)) if (claims[k] === undefined) delete claims[k];
  return jwt.sign(claims, key, { algorithm: 'RS256', keyid: kid });
};

/** Leg 1: GET /start. Returns what the browser would carry onward. */
const start = async (from, query = '') => {
  const res = await request(app)
    .get(`/api/auth/google/start${query}`)
    .set('X-Forwarded-For', from);
  expect(res.status).toBe(302);
  const url = new URL(res.headers.location);
  const cookie = (res.headers['set-cookie'] || []).find((c) => c.startsWith('pf_oauth='));
  return {
    url,
    state:  url.searchParams.get('state'),
    nonce:  url.searchParams.get('nonce'),
    cookie: cookie ? cookie.split(';')[0] : null,
  };
};

/** Leg 2: Google redirects back; `claims` are what Google's token says. */
const callback = async (from, flow, claims = {}, { cookie = flow.cookie, query, signWith } = {}) => {
  jest.spyOn(google.getClient(), 'getToken').mockResolvedValue({
    tokens: { id_token: idToken({ nonce: flow.nonce, ...claims }, signWith) },
  });
  const req = request(app)
    .get(`/api/auth/google/callback${query ?? `?state=${encodeURIComponent(flow.state)}&code=auth-code`}`)
    .set('X-Forwarded-For', from);
  if (cookie) req.set('Cookie', cookie);
  const res = await req;
  expect(res.status).toBe(302);
  const url = new URL(res.headers.location);
  const hash = new URLSearchParams(url.hash.slice(1));
  return { res, url, handoff: hash.get('handoff'), error: hash.get('google_error') };
};

/** Leg 3: the SPA trades the handoff. */
const exchange = (from, code) =>
  request(app).post('/api/auth/google/exchange').set('X-Forwarded-For', from).send({ code });

/** The whole happy path; returns the exchange response. */
const signIn = async (claims = {}, query = '') => {
  const from = nextIp();
  const flow = await start(from, query);
  const back = await callback(from, flow, claims);
  expect(back.error).toBeNull();
  return exchange(from, back.handoff);
};

describe('GET /api/auth/google/start', () => {
  it('sends the browser to Google with PKCE, state, nonce and only openid+email', async () => {
    const { url, state, nonce, cookie } = await start(nextIp());

    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    const p = url.searchParams;
    expect(p.get('client_id')).toBe(ENV.GOOGLE_CLIENT_ID);
    expect(p.get('redirect_uri')).toBe(ENV.GOOGLE_REDIRECT_URI);
    expect(p.get('response_type')).toBe('code');
    expect(p.get('scope')).toBe('openid email');
    expect(p.get('code_challenge_method')).toBe('S256');
    expect(p.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(state).not.toBe(nonce);
    expect(cookie).toMatch(/^pf_oauth=[A-Za-z0-9_-]{43}$/);
  });

  it('sets the binding cookie httpOnly, Lax, scoped to the Google routes', async () => {
    const res = await request(app).get('/api/auth/google/start').set('X-Forwarded-For', nextIp());
    const cookie = res.headers['set-cookie'].find((c) => c.startsWith('pf_oauth='));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\/api\/auth\/google(;|$)/);
  });

  it('stores only HASHES of what the browser will present', async () => {
    const { state, nonce, cookie } = await start(nextIp());
    const [row] = await OAuthFlow.find({}).lean();
    const values = JSON.stringify(row);
    expect(values).not.toContain(state);
    expect(values).not.toContain(nonce);
    expect(values).not.toContain(cookie.split('=')[1]);
    expect(row.codeVerifier).toMatch(/^[A-Za-z0-9._~-]{43,128}$/);
  });

  it('fails CLOSED to the login page when Google is not configured', async () => {
    const before = process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_CLIENT_SECRET;
    try {
      const res = await request(app).get('/api/auth/google/start').set('X-Forwarded-For', nextIp());
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(`${ENV.FRONTEND_URL}/admin/login#google_error=unavailable`);
      expect(await OAuthFlow.countDocuments()).toBe(0);
    } finally {
      process.env.GOOGLE_CLIENT_SECRET = before;
    }
  });

  it('answers 503 when there is no frontend to send the browser back to', async () => {
    const before = process.env.FRONTEND_URL;
    delete process.env.FRONTEND_URL;
    try {
      const res = await request(app).get('/api/auth/google/start').set('X-Forwarded-For', nextIp());
      expect(res.status).toBe(503);
    } finally {
      process.env.FRONTEND_URL = before;
    }
  });
});

describe('a complete sign-in', () => {
  beforeEach(() => User.create(ADMIN));

  it('ends in the SAME session password login issues — protect accepts it', async () => {
    const res = await signIn();

    expect(res.status).toBe(200);
    expect(res.body.accessToken.split('.')).toHaveLength(3);
    expect(res.body.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(res.body.data.email).toBe(PRIMARY);

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${res.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(PRIMARY);
  });

  it('records the sign-in in the history: ok, by Google, the address used (PF-133)', async () => {
    const res = await signIn({ sub: 'google-sub-second', email: SECOND });
    expect(res.status).toBe(200);
    expect(await SignInEvent.find({}, '-_id user kind outcome method address').lean()).toEqual([
      { user: expect.anything(), kind: 'sign-in', outcome: 'ok', method: 'google', address: SECOND },
    ]);
  });

  it('works from the SECOND address too, as the same account', async () => {
    const a = await signIn();
    const b = await signIn({ sub: 'google-sub-second', email: SECOND });

    expect(b.status).toBe(200);
    expect(b.body.data.id).toBe(a.body.data.id);
    const user = await User.findOne({}).select('+googleIdentities').lean();
    expect(user.googleIdentities).toEqual([
      { sub: 'google-sub-primary', email: PRIMARY },
      { sub: 'google-sub-second',  email: SECOND },
    ]);
  });

  it('matches the address case-insensitively, as Google may capitalise it', async () => {
    const res = await signIn({ email: 'PCGallege@Gmail.com' });
    expect(res.status).toBe(200);
  });

  it('carries returnTo through Google and back', async () => {
    const res = await signIn({}, '?returnTo=%2Fadmin%3Ftab%3Dblog');
    expect(res.body.returnTo).toBe('/admin?tab=blog');
  });

  it('sends the handoff in the FRAGMENT, never the query string', async () => {
    const from = nextIp();
    const flow = await start(from);
    const back = await callback(from, flow);
    expect(back.url.search).toBe('');
    expect(back.url.pathname).toBe('/admin/login');
    expect(back.handoff).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('clears the binding cookie on the way back', async () => {
    const from = nextIp();
    const flow = await start(from);
    const { res } = await callback(from, flow);
    const cleared = res.headers['set-cookie'].find((c) => c.startsWith('pf_oauth='));
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});

describe('the panel names the Google address used (PF-119 follow-up)', () => {
  beforeEach(() => User.create(ADMIN));

  it('/auth/me reports the second address after signing in with it', async () => {
    const res = await signIn({ sub: 'google-sub-second', email: SECOND });
    expect(res.status).toBe(200);
    const me = await request(app).get('/api/auth/me')
      .set('Authorization', `Bearer ${res.body.accessToken}`);
    expect(me.body.data.signedInAs).toBe(SECOND);
    // PF-131: and HOW — the Settings card names the Google door.
    expect(me.body.data.signedInWith).toBe('google');
    expect(me.body.data.email).toBe(PRIMARY);
  });
});

describe('who may sign in — the allowlist', () => {
  beforeEach(() => User.create(ADMIN));

  it('refuses a verified Google account that is not an admin address, and CREATES NOTHING', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const from = nextIp();
    const flow = await start(from);
    const back = await callback(from, flow, { email: 'stranger@gmail.com', sub: 'stranger' });

    expect(back.error).toBe('not_allowed');
    expect(back.handoff).toBeNull();
    // The ZERO case — the one that matters: no account appeared.
    expect(await User.countDocuments()).toBe(1);
    expect(await OAuthFlow.countDocuments()).toBe(0);
    // …and the operator is told where to look.
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/migration 009/));
    // PF-133: the refusal is in the owner's sign-in history, with no account.
    expect(await SignInEvent.find({}, '-_id user kind outcome method address').lean()).toEqual([
      { user: null, kind: 'sign-in', outcome: 'failed', method: 'google', address: 'stranger@gmail.com' },
    ]);
  });

  it('refuses an UNVERIFIED address even when it is the admin\'s', async () => {
    const from = nextIp();
    const back = await callback(from, await start(from), { email_verified: false });
    expect(back.error).toBe('not_allowed');
  });

  it('refuses when email_verified is the STRING "true", not the boolean', async () => {
    const from = nextIp();
    const back = await callback(from, await start(from), { email_verified: 'true' });
    expect(back.error).toBe('not_allowed');
  });

  it('refuses a DIFFERENT Google account presenting an address already bound', async () => {
    expect((await signIn()).status).toBe(200);

    const from = nextIp();
    const back = await callback(from, await start(from), { sub: 'someone-else' });
    expect(back.error).toBe('not_allowed');
    const user = await User.findOne({}).select('+googleIdentities').lean();
    expect(user.googleIdentities).toHaveLength(1);
  });

  it('refuses a Google account bound to ANOTHER user record', async () => {
    await User.create({
      email: 'other@test.com', password: 'TestPass@1234!',
      googleIdentities: [{ sub: 'google-sub-primary', email: 'other@test.com' }],
    });
    const from = nextIp();
    const back = await callback(from, await start(from));
    expect(back.error).toBe('not_allowed');
  });
});

describe('the ID token is verified, not decoded', () => {
  beforeEach(() => User.create(ADMIN));

  const refused = async (claims, opts) => {
    const from = nextIp();
    return (await callback(from, await start(from), claims, opts)).error;
  };

  it('control: the same helper with honest claims succeeds', async () => {
    expect(await refused({})).toBeNull();
  });

  it('refuses a token minted for another app (aud)', async () => {
    expect(await refused({ aud: 'someone-elses-client-id' })).toBe('failed');
  });

  it('refuses a token from another issuer (iss)', async () => {
    expect(await refused({ iss: 'https://evil.example' })).toBe('failed');
  });

  it('refuses an expired token (beyond the library\'s 5-minute skew)', async () => {
    const now = Math.floor(Date.now() / 1000);
    expect(await refused({ iat: now - 7200, exp: now - 3600 })).toBe('failed');
  });

  it('refuses a token signed by a key Google never published', async () => {
    expect(await refused({}, { signWith: { key: OTHER_KEY } })).toBe('failed');
  });

  it('refuses a token whose nonce is not this flow\'s', async () => {
    expect(await refused({ nonce: 'replayed-from-another-sign-in' })).toBe('failed');
  });

  it('refuses a token with no nonce at all', async () => {
    expect(await refused({ nonce: undefined })).toBe('failed');
  });

  it('refuses when Google returns no ID token', async () => {
    const from = nextIp();
    const flow = await start(from);
    jest.spyOn(google.getClient(), 'getToken').mockResolvedValue({ tokens: {} });
    const res = await request(app)
      .get(`/api/auth/google/callback?state=${flow.state}&code=x`)
      .set('X-Forwarded-For', from).set('Cookie', flow.cookie);
    expect(res.headers.location).toMatch(/#google_error=failed$/);
  });
});

describe('every value is single-use and bound to its browser', () => {
  beforeEach(() => User.create(ADMIN));

  it('refuses a callback without the binding cookie (another browser)', async () => {
    const from = nextIp();
    const back = await callback(from, await start(from), {}, { cookie: null });
    expect(back.error).toBe('failed');
  });

  it('refuses a callback with a DIFFERENT browser\'s cookie', async () => {
    const from = nextIp();
    const mine  = await start(from);
    const other = await start(from);
    const back = await callback(from, mine, {}, { cookie: other.cookie });
    expect(back.error).toBe('failed');
  });

  it('refuses a replayed state — the flow was spent by the first callback', async () => {
    const from = nextIp();
    const flow = await start(from);
    expect((await callback(from, flow)).error).toBeNull();
    expect((await callback(from, flow)).error).toBe('expired');
  });

  it('refuses an unknown state', async () => {
    const from = nextIp();
    const flow = await start(from);
    const back = await callback(from, flow, {}, { query: '?state=made-up&code=x' });
    expect(back.error).toBe('expired');
  });

  it('refuses a state sent twice (an array, not a string)', async () => {
    const from = nextIp();
    const flow = await start(from);
    const back = await callback(from, flow, {}, { query: `?state=${flow.state}&state=${flow.state}&code=x` });
    expect(back.error).toBe('expired');
  });

  it('refuses an expired flow even if the row still exists', async () => {
    const from = nextIp();
    const flow = await start(from);
    await OAuthFlow.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await callback(from, flow)).error).toBe('expired');
  });

  it('reports Cancel at Google as cancelled, and spends the flow', async () => {
    const from = nextIp();
    const flow = await start(from);
    const back = await callback(from, flow, {}, { query: `?state=${flow.state}&error=access_denied` });
    expect(back.error).toBe('cancelled');
    expect(await OAuthFlow.countDocuments()).toBe(0);
  });

  it('refuses a replayed handoff — the second exchange gets no session', async () => {
    const from = nextIp();
    const back = await callback(from, await start(from));
    expect((await exchange(from, back.handoff)).status).toBe(200);
    const again = await exchange(from, back.handoff);
    expect(again.status).toBe(401);
    expect(again.body.accessToken).toBeUndefined();
  });

  it('refuses an expired handoff', async () => {
    const from = nextIp();
    const back = await callback(from, await start(from));
    await OAuthFlow.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await exchange(from, back.handoff)).status).toBe(401);
  });

  it('400s an exchange with no code, or a non-string one', async () => {
    const from = nextIp();
    expect((await exchange(from, undefined)).status).toBe(400);
    expect((await exchange(from, ['a'])).status).toBe(400);
  });
});

describe('safeReturnTo — the value ends up in navigate(), so it may not leave /admin', () => {
  it.each([
    ['/admin', '/admin'],
    ['/admin/', '/admin/'],
    ['/admin?tab=blog', '/admin?tab=blog'],
    ['/admin#x', '/admin#x'],
  ])('keeps %s', (input, out) => expect(safeReturnTo(input)).toBe(out));

  it.each([
    'https://evil.com/admin',
    '//evil.com',
    '/\\evil.com',
    ' /admin',
    '/administrator',
    '/blog',
    '',
    undefined,
    ['/admin'],
  ])('replaces %p with /admin', (input) => expect(safeReturnTo(input)).toBe('/admin'));
});
