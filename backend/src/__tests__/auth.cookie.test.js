/**
 * PF-147 — the refresh token's cookie: its exact settings at every door, that
 * the token never appears in a body, and that another website cannot act on it.
 *
 * Over https (`X-Forwarded-Proto`, which `trust proxy` honours as it does on
 * Vercel) the settings are the production ones; over supertest's plain http
 * they are the ones local development gets.
 */
const express = require('express');
const request = require('supertest');
const app     = require('../app');
const fromOurSite  = require('../middleware/fromOurSite');
const errorHandler = require('../middleware/errorHandler');
const User    = require('../models/User');
const Session = require('../models/Session');
const OAuthFlow = require('../models/OAuthFlow');
const { issueSession, hashToken } = require('../services/sessionService');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');
const { OUR_ORIGIN, asOurSite, setCookieLine, refreshCookieOf } = require('./helpers/refreshCookie');

beforeAll(connectTestDB);
afterEach(clearDB);
afterAll(disconnectTestDB);

const ADMIN = { email: 'admin@test.com', password: 'TestPass@1234!' };
const SECURE_NAME = '__Host-Http-pg_refresh';
const SEVEN_DAYS = 7 * 24 * 60 * 60;

let user;
beforeEach(async () => { user = await User.create(ADMIN); });

const overHttps = (req) => req.set('X-Forwarded-Proto', 'https');

// The attributes of one Set-Cookie line, lower-cased names, in a plain object.
const attributesOf = (line) => Object.fromEntries(
  line.split(';').slice(1).map((part) => {
    const [name, value = true] = part.trim().split('=');
    return [name.toLowerCase(), value];
  })
);

const expectProductionCookie = (res) => {
  expect(res.status).toBe(200);
  const line = setCookieLine(res, SECURE_NAME);
  expect(line).toBeDefined();
  const attrs = attributesOf(line);
  expect(attrs).toMatchObject({ httponly: true, secure: true, samesite: 'Strict', path: '/' });
  expect(attrs.domain).toBeUndefined();
  expect(Number(attrs['max-age'])).toBeGreaterThan(SEVEN_DAYS - 5);
  expect(Number(attrs['max-age'])).toBeLessThanOrEqual(SEVEN_DAYS);
  // The token's value is nowhere a page script could read it.
  const token = line.split(';')[0].slice(SECURE_NAME.length + 1);
  expect(JSON.stringify(res.body)).not.toContain(token);
  expect(res.body.refreshToken).toBeUndefined();
  expect(res.body.refreshExpiresAt).toEqual(expect.any(String));
};

const googleHandoff = async () => {
  await OAuthFlow.create({
    handoffHash: hashToken('one-time-code'),
    user: user._id,
    signedInAs: ADMIN.email,
    returnTo: '/admin',
    expiresAt: new Date(Date.now() + 60 * 1000),
  });
};

describe('The refresh cookie at every door, over https', () => {
  it('password sign-in', async () => {
    expectProductionCookie(await overHttps(request(app).post('/api/auth/login')).send(ADMIN));
  });

  it('Google sign-in', async () => {
    await googleHandoff();
    const res = await overHttps(request(app).post('/api/auth/google/exchange')).send({ code: 'one-time-code' });
    expectProductionCookie(res);
    expect(res.body.returnTo).toBe('/admin');
  });

  it('refresh, which reads the same name it writes', async () => {
    const { refreshToken } = await issueSession(user);
    const res = await overHttps(request(app).post('/api/auth/refresh'))
      .set('Origin', OUR_ORIGIN)
      .set('Cookie', `${SECURE_NAME}=${refreshToken}`);
    expectProductionCookie(res);
  });

  it('sign-out removes it, with the settings a __Host- cookie must be removed with', async () => {
    const { refreshToken } = await issueSession(user);
    const res = await overHttps(request(app).post('/api/auth/logout'))
      .set('Origin', OUR_ORIGIN)
      .set('Cookie', `${SECURE_NAME}=${refreshToken}`);

    expect(res.status).toBe(200);
    const line = setCookieLine(res, SECURE_NAME);
    expect(line.split(';')[0]).toBe(`${SECURE_NAME}=`);
    const attrs = attributesOf(line);
    expect(attrs).toMatchObject({ httponly: true, secure: true, samesite: 'Strict', path: '/' });
    expect(Date.parse(attrs.expires)).toBeLessThan(Date.now());
    expect(await Session.countDocuments({ revokedAt: null })).toBe(0);
  });

  it('a plain cookie is not accepted in place of the prefixed one', async () => {
    const { refreshToken } = await issueSession(user);
    const res = await overHttps(request(app).post('/api/auth/refresh'))
      .set('Origin', OUR_ORIGIN)
      .set('Cookie', `pg_refresh=${refreshToken}`);
    expect(res.status).toBe(401);
  });
});

describe('The refresh cookie over local http', () => {
  it('uses the plain name and no Secure, which http could not set', async () => {
    const res = await request(app).post('/api/auth/login').send(ADMIN);
    const attrs = attributesOf(setCookieLine(res));
    expect(attrs).toMatchObject({ httponly: true, samesite: 'Strict', path: '/' });
    expect(attrs.secure).toBeUndefined();
    expect(setCookieLine(res, SECURE_NAME)).toBeUndefined();
  });
});

describe('Only the cookie counts', () => {
  it('refresh ignores a token in the body', async () => {
    const { refreshToken } = await issueSession(user);
    const res = await asOurSite(request(app).post('/api/auth/refresh')).send({ refreshToken });
    expect(res.status).toBe(401);
    expect(await Session.countDocuments({ revokedAt: null })).toBe(1);
  });

  it('sign-out ignores a token in the body', async () => {
    const { refreshToken } = await issueSession(user);
    const res = await asOurSite(request(app).post('/api/auth/logout')).send({ refreshToken });
    expect(res.status).toBe(200);
    expect(await Session.countDocuments({ revokedAt: null })).toBe(1);
  });

  it('what sign-in sets is what refresh reads', async () => {
    const login = await request(app).post('/api/auth/login').send(ADMIN);
    const res = await asOurSite(request(app).post('/api/auth/refresh'), refreshCookieOf(login));
    expect(res.status).toBe(200);
  });
});

describe('fromOurSite — another website cannot act on the cookie', () => {
  const ROUTES = ['/api/auth/refresh', '/api/auth/logout'];

  const expectUntouched = async () => {
    expect(await Session.countDocuments({ revokedAt: null })).toBe(1);
    expect(await Session.countDocuments({ replacedBy: { $ne: null } })).toBe(0);
  };

  describe.each(ROUTES)('%s', (route) => {
    let refreshToken;
    beforeEach(async () => { ({ refreshToken } = await issueSession(user)); });

    const send = (headers) => request(app).post(route).set({ Cookie: `pg_refresh=${refreshToken}`, ...headers });

    it('passes the site’s own request (the control)', async () => {
      expect((await send({ Origin: OUR_ORIGIN, 'Sec-Fetch-Site': 'same-site' })).status).toBe(200);
    });

    it('passes same-origin (the local proxy)', async () => {
      expect((await send({ Origin: OUR_ORIGIN, 'Sec-Fetch-Site': 'same-origin' })).status).toBe(200);
    });

    it('passes an allowed Origin from a browser that sends no Sec-Fetch-Site', async () => {
      expect((await send({ Origin: OUR_ORIGIN })).status).toBe(200);
    });

    it('refuses cross-site, even from an Origin on the list (the old address)', async () => {
      const res = await send({ Origin: OUR_ORIGIN, 'Sec-Fetch-Site': 'cross-site' });
      expect(res.status).toBe(403);
      await expectUntouched();
    });

    it('refuses Sec-Fetch-Site: none, which an address-bar visit sends', async () => {
      expect((await send({ Origin: OUR_ORIGIN, 'Sec-Fetch-Site': 'none' })).status).toBe(403);
      await expectUntouched();
    });

    it('refuses a missing Origin: a missing header is not evidence of safety', async () => {
      expect((await send({ 'Sec-Fetch-Site': 'same-site' })).status).toBe(403);
      expect((await send({})).status).toBe(403);
      await expectUntouched();
    });

    it('refuses Origin: null', async () => {
      expect((await send({ Origin: 'null', 'Sec-Fetch-Site': 'same-site' })).status).toBe(403);
      await expectUntouched();
    });
  });

  // On its own app: through the real one, CORS refuses this Origin first, and
  // the test would pass with the guard's Origin check removed.
  it('refuses a same-site sibling that is not on the list', async () => {
    const stub = express();
    stub.post('/', fromOurSite, (_req, res) => res.json({ reached: true }));
    stub.use(errorHandler);

    const send = (origin) => request(stub).post('/').set({ Origin: origin, 'Sec-Fetch-Site': 'same-site' });

    expect((await send(OUR_ORIGIN)).status).toBe(200);   // the control
    expect((await send('https://www.parindragallage.com')).status).toBe(403);
    expect((await send('https://parindragallage.com.evil.example')).status).toBe(403);
  });

  it('the answer is in plain words', async () => {
    const res = await request(app).post('/api/auth/refresh').set('Sec-Fetch-Site', 'cross-site');
    expect(res.body.message).toMatch(/didn't come from this site/i);
  });
});

describe('The privacy page’s promise: no cookies for visitors', () => {
  it.each(['/api/health', '/api/about', '/api/projects', '/api/blog', '/api/skills'])(
    'a public read of %s sets no cookie',
    async (url) => {
      const res = await request(app).get(url);
      expect(res.headers['set-cookie']).toBeUndefined();
    }
  );
});
