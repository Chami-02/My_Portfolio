// frontend/src/services/__tests__/api.test.js
//
// PF-108 — the axios interceptors: bearer attach, silent refresh, replay,
// single-flight, and what happens when the refresh itself fails.
//
// Driven through the REAL axios pipeline with a scripted adapter, not a
// mocked `api` — the properties under test (does the replayed request carry
// the NEW token? does the interceptor see `error.response.status`?) live in
// how axios wires config → adapter → interceptors, and a stub of `api` would
// pass while asserting nothing about that.
import { describe, it, expect, beforeEach } from 'vitest';
import { AxiosError } from 'axios';
import api, { refreshSession } from '../api';
import { session, ME_KEY }     from '../session';
import { queryClient }         from '../../lib/queryClient';

const PAIR = {
  accessToken:      'access-1',
  refreshToken:     'refresh-1',
  accessExpiresAt:  '2026-09-16T10:15:00.000Z',
  refreshExpiresAt: '2026-09-23T10:00:00.000Z',
};
const NEXT = {
  accessToken:      'access-2',
  refreshToken:     'refresh-2',
  accessExpiresAt:  '2026-09-16T10:30:00.000Z',
  refreshExpiresAt: '2026-09-23T10:15:00.000Z',
};

const bearerOf = (config) =>
  config.headers.get?.('Authorization') ?? config.headers.Authorization ?? null;

const ok = (config, data) =>
  ({ data, status: 200, statusText: 'OK', headers: {}, config });

const unauthorized = (config) =>
  new AxiosError(
    'Request failed with status code 401',
    AxiosError.ERR_BAD_REQUEST,
    config,
    null,
    { data: { message: 'Your session has ended.' }, status: 401, statusText: 'Unauthorized', headers: {}, config },
  );

/**
 * Script the adapter. `plan` maps a URL to a function of (config, nth call
 * for that URL) that returns a response or throws an AxiosError. Every call
 * is recorded so tests can assert what went on the wire, in what order,
 * with which bearer.
 */
const calls = [];
const install = (plan) => {
  calls.length = 0;
  const seen = {};
  api.defaults.adapter = async (config) => {
    const url = config.url;
    seen[url] = (seen[url] ?? 0) + 1;
    calls.push({ url, bearer: bearerOf(config), body: config.data });
    const handler = plan[url];
    if (!handler) throw new Error(`unplanned request: ${url}`);
    return handler(config, seen[url]);
  };
};
const count = (url) => calls.filter((c) => c.url === url).length;

beforeEach(() => {
  localStorage.clear();
  session.clear();
  queryClient.clear();
});

describe('request interceptor', () => {
  it('attaches the in-memory access token as a Bearer header', async () => {
    session.set(PAIR);
    install({ '/x': (c) => ok(c, { fine: true }) });

    const res = await api.get('/x');
    expect(res.data).toEqual({ fine: true });
    expect(calls[0].bearer).toBe('Bearer access-1');
  });

  it('sends no Authorization header when there is no token', async () => {
    install({ '/x': (c) => ok(c, {}) });
    await api.get('/x');
    expect(calls[0].bearer).toBeNull();
  });
});

describe('response interceptor — silent refresh', () => {
  it('on a 401, refreshes once and replays with the NEW token', async () => {
    session.set(PAIR);
    install({
      '/x': (c, n) => { if (n === 1) throw unauthorized(c); return ok(c, { after: 'refresh' }); },
      '/auth/refresh': (c) => ok(c, NEXT),
    });

    const res = await api.get('/x');

    expect(res.data).toEqual({ after: 'refresh' });
    expect(calls.map((c) => c.url)).toEqual(['/x', '/auth/refresh', '/x']);
    // The refresh presented the STORED refresh token…
    expect(JSON.parse(calls[1].body)).toEqual({ refreshToken: 'refresh-1' });
    // …the replay carried the token the refresh returned, not the dead one…
    expect(calls[2].bearer).toBe('Bearer access-2');
    // …and the store now holds the rotated pair.
    expect(session.getAccessToken()).toBe('access-2');
    expect(session.getRefreshToken()).toBe('refresh-2');
  });

  it('SINGLE-FLIGHT: five concurrent 401s produce exactly ONE refresh', async () => {
    // Five panels load at once against a dead access token. Without the
    // lock, five refreshes would race with the same refresh token, and the
    // backend's reuse detection would revoke the session the first one
    // had just renewed — the app would log itself out on every expiry.
    session.set(PAIR);
    install({
      '/a': (c, n) => { if (n === 1) throw unauthorized(c); return ok(c, 'a'); },
      '/b': (c, n) => { if (n === 1) throw unauthorized(c); return ok(c, 'b'); },
      '/c': (c, n) => { if (n === 1) throw unauthorized(c); return ok(c, 'c'); },
      '/d': (c, n) => { if (n === 1) throw unauthorized(c); return ok(c, 'd'); },
      '/e': (c, n) => { if (n === 1) throw unauthorized(c); return ok(c, 'e'); },
      '/auth/refresh': (c) => ok(c, NEXT),
    });

    const results = await Promise.all(['/a', '/b', '/c', '/d', '/e'].map((u) => api.get(u)));

    expect(results.map((r) => r.data)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(count('/auth/refresh')).toBe(1);
    // Every replay used the new token
    const replays = calls.filter((c) => c.url !== '/auth/refresh' && c.bearer === 'Bearer access-2');
    expect(replays).toHaveLength(5);
  });

  it('when the refresh FAILS: clears the session, writes null into the me cache, rejects the ORIGINAL 401', async () => {
    session.set(PAIR);
    queryClient.setQueryData(ME_KEY, { email: 'owner@example.com' });
    install({
      '/x': (c) => { throw unauthorized(c); },
      '/auth/refresh': (c) => { throw unauthorized(c); },
    });

    await expect(api.get('/x')).rejects.toMatchObject({
      config:   expect.objectContaining({ url: '/x' }),
      response: expect.objectContaining({ status: 401 }),
    });

    expect(session.getAccessToken()).toBeNull();
    expect(session.getRefreshToken()).toBeNull();
    // null, NOT removed: removal would make an active useMe refetch and
    // 401 straight back into this path. ProtectedRoute treats null as
    // signed out without another request.
    expect(queryClient.getQueryState(ME_KEY)?.data).toBeNull();
    expect(count('/x')).toBe(1);   // no replay after a failed refresh
  });

  it('with no stored refresh token, rejects immediately and never calls /auth/refresh', async () => {
    session.set({ accessToken: 'stale-only' });   // memory half, nothing in storage
    install({ '/x': (c) => { throw unauthorized(c); } });

    await expect(api.get('/x')).rejects.toMatchObject({ response: { status: 401 } });
    expect(count('/auth/refresh')).toBe(0);
  });

  it('a 401 from /auth/login is a wrong password, not a dead session — no refresh', async () => {
    session.set(PAIR);
    install({ '/auth/login': (c) => { throw unauthorized(c); } });

    await expect(api.post('/auth/login', {})).rejects.toMatchObject({ response: { status: 401 } });
    expect(count('/auth/refresh')).toBe(0);
    expect(session.getRefreshToken()).toBe('refresh-1');   // untouched
  });

  it('replays at most ONCE — a second 401 after a good refresh is surfaced, not looped', async () => {
    session.set(PAIR);
    install({
      '/x': (c) => { throw unauthorized(c); },   // 401 every time
      '/auth/refresh': (c) => ok(c, NEXT),
    });

    await expect(api.get('/x')).rejects.toMatchObject({ response: { status: 401 } });
    expect(count('/x')).toBe(2);
    expect(count('/auth/refresh')).toBe(1);
  });

  it('a non-401 error passes straight through untouched', async () => {
    session.set(PAIR);
    install({
      '/x': (c) => {
        throw new AxiosError('boom', AxiosError.ERR_BAD_RESPONSE, c, null,
          { data: {}, status: 500, statusText: 'Server Error', headers: {}, config: c });
      },
    });

    await expect(api.get('/x')).rejects.toMatchObject({ response: { status: 500 } });
    expect(count('/auth/refresh')).toBe(0);
    expect(session.getRefreshToken()).toBe('refresh-1');
  });
});

describe('refreshSession (the export authService.refresh uses)', () => {
  it('shares the single-flight lock with the interceptor', async () => {
    session.set(PAIR);
    install({ '/auth/refresh': (c) => ok(c, NEXT) });

    const [a, b, c] = await Promise.all([refreshSession(), refreshSession(), refreshSession()]);

    expect(count('/auth/refresh')).toBe(1);
    expect([a, b, c]).toEqual(['access-2', 'access-2', 'access-2']);
  });

  it('releases the lock afterwards so a later refresh is a new request', async () => {
    session.set(PAIR);
    install({ '/auth/refresh': (c) => ok(c, NEXT) });

    await refreshSession();
    await refreshSession();
    expect(count('/auth/refresh')).toBe(2);
  });

  it('rejects without a network call when nothing is stored', async () => {
    install({});
    await expect(refreshSession()).rejects.toThrow(/no refresh token/i);
    expect(calls).toHaveLength(0);
  });
});
