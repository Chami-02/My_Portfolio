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
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AxiosError } from 'axios';
import api, { refreshSession } from '../api';
import { session, ME_KEY }     from '../session';
import { queryClient }         from '../../lib/queryClient';

const PAIR = {
  accessToken:      'access-1',
  accessExpiresAt:  '2026-09-16T10:15:00.000Z',
  refreshExpiresAt: '2026-09-23T10:00:00.000Z',
};
const NEXT = {
  accessToken:      'access-2',
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
    calls.push({ url, bearer: bearerOf(config), body: config.data, withCredentials: config.withCredentials, timeout: config.timeout });
    const handler = plan[url];
    if (!handler) throw new Error(`unplanned request: ${url}`);
    return handler(config, seen[url]);
  };
};
const count = (url) => calls.filter((c) => c.url === url).length;

const statusError = (config, status) =>
  new AxiosError(`Request failed with status code ${status}`, AxiosError.ERR_BAD_RESPONSE, config, null,
    { data: {}, status, statusText: '', headers: {}, config });

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
    // The refresh asked the browser to send its cookie, with nothing in the body…
    expect(calls[1].withCredentials).toBe(true);
    expect(calls[1].body == null).toBe(true);
    // …the replay carried the token the refresh returned, not the dead one…
    expect(calls[2].bearer).toBe('Bearer access-2');
    // …and the store now holds the rotated pair.
    expect(session.getAccessToken()).toBe('access-2');
    expect(session.getRefreshExpiresAt()).toBe(Date.parse(NEXT.refreshExpiresAt));
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
    expect(session.getRefreshExpiresAt()).toBeNull();
    // null, NOT removed: removal would make an active useMe refetch and
    // 401 straight back into this path. ProtectedRoute treats null as
    // signed out without another request.
    expect(queryClient.getQueryState(ME_KEY)?.data).toBeNull();
    expect(count('/x')).toBe(1);   // no replay after a failed refresh
  });

  it('with nothing stored, still asks: only the browser knows whether it holds the cookie', async () => {
    // localStorage can be blocked while cookies work, so storage must not decide.
    install({
      '/x': (c, n) => { if (n === 1) throw unauthorized(c); return ok(c, 'fine'); },
      '/auth/refresh': (c) => ok(c, NEXT),
    });

    const res = await api.get('/x');

    expect(res.data).toBe('fine');
    expect(count('/auth/refresh')).toBe(1);
  });

  // PF-147 — only a 401 ends a session. Each of these used to sign the admin out.
  describe.each([
    ['no answer at all', (c) => new AxiosError('Network Error', AxiosError.ERR_NETWORK, c), undefined],
    ['a timeout', (c) => new AxiosError('timeout', AxiosError.ECONNABORTED, c), undefined],
    ['too many requests', (c) => statusError(c, 429), 429],
    ['a server failure', (c) => statusError(c, 500), 500],
    ['the repeat window’s "try again"', (c) => statusError(c, 503), 503],
    ['a refused origin', (c) => statusError(c, 403), 403],
  ])('when the refresh fails with %s', (_name, failure, status) => {
    beforeEach(() => {
      session.set(PAIR);
      queryClient.setQueryData(ME_KEY, { email: 'owner@example.com' });
      install({
        '/x': (c) => { throw unauthorized(c); },
        '/auth/refresh': (c) => { throw failure(c); },
      });
    });

    it('keeps the session and the me cache', async () => {
      await expect(api.get('/x')).rejects.toBeDefined();

      expect(session.getRefreshExpiresAt()).toBe(Date.parse(PAIR.refreshExpiresAt));
      expect(session.probablySignedIn()).toBe(true);
      expect(queryClient.getQueryData(ME_KEY)).toEqual({ email: 'owner@example.com' });
    });

    it('rejects with the REFRESH error, never the original 401 that means "signed out"', async () => {
      const err = await api.get('/x').catch((e) => e);

      expect(err.response?.status).toBe(status);
      expect(err.config.url).toBe('/auth/refresh');
      expect(count('/x')).toBe(1);   // no replay
    });
  });

  it('a 401 from /auth/login is a wrong password, not a dead session — no refresh', async () => {
    session.set(PAIR);
    install({ '/auth/login': (c) => { throw unauthorized(c); } });

    await expect(api.post('/auth/login', {})).rejects.toMatchObject({ response: { status: 401 } });
    expect(count('/auth/refresh')).toBe(0);
    expect(session.probablySignedIn()).toBe(true);   // untouched
  });

  it('a 401 from the Google exchange is a spent handoff, not a dead session — no refresh (PF-119)', async () => {
    session.set(PAIR);
    install({ '/auth/google/exchange': (c) => { throw unauthorized(c); } });

    await expect(api.post('/auth/google/exchange', {})).rejects.toMatchObject({ response: { status: 401 } });
    expect(count('/auth/refresh')).toBe(0);
    expect(session.probablySignedIn()).toBe(true);   // untouched
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
    expect(session.probablySignedIn()).toBe(true);
  });

  it('an ordinary request never asks for the cookie', async () => {
    install({ '/x': (c) => ok(c, {}) });
    await api.get('/x');
    expect(calls[0].withCredentials).toBeFalsy();
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

  it('gives a slow renewal longer than the 12 s every other call gets', async () => {
    install({ '/x': (c) => ok(c, {}), '/auth/refresh': (c) => ok(c, NEXT) });
    await api.get('/x');
    await refreshSession();
    expect(calls[0].timeout).toBe(12000);
    expect(calls[1].timeout).toBe(30000);
  });

  it('releases the lock after a failure too, so the next try is a new request', async () => {
    install({
      '/auth/refresh': (c, n) => {
        if (n === 1) throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, c);
        return ok(c, NEXT);
      },
    });
    await expect(refreshSession()).rejects.toBeDefined();
    await expect(refreshSession()).resolves.toBe('access-2');
  });
});

// PF-147 — two TABS are two copies of this module, so the in-tab lock above
// cannot stop them. The browser's own lock can.
describe('refreshSession across tabs', () => {
  afterEach(() => { delete navigator.locks; });

  // Hands the lock to one holder at a time, as the browser does.
  const fakeLocks = () => {
    const log = [];
    let tail = Promise.resolve();
    return {
      log,
      request(name, work) {
        log.push(name);
        const turn = tail.then(work);
        tail = turn.catch(() => {});
        return turn;
      },
    };
  };

  it('renews inside the browser lock, and the other tab waits its turn', async () => {
    const locks = fakeLocks();
    Object.defineProperty(navigator, 'locks', { value: locks, configurable: true });

    // Another tab holds the lock until this is released.
    let releaseOtherTab;
    locks.request('pf-session-refresh', () => new Promise((r) => { releaseOtherTab = r; }));
    await Promise.resolve();

    install({ '/auth/refresh': (c) => ok(c, NEXT) });
    const mine = refreshSession();
    await new Promise((r) => { setTimeout(r, 10); });
    expect(count('/auth/refresh')).toBe(0);   // still waiting

    releaseOtherTab();
    await expect(mine).resolves.toBe('access-2');
    expect(count('/auth/refresh')).toBe(1);
    expect(locks.log).toEqual(['pf-session-refresh', 'pf-session-refresh']);
  });

  it('a browser without the lock renews anyway', async () => {
    expect(navigator.locks).toBeUndefined();
    install({ '/auth/refresh': (c) => ok(c, NEXT) });
    await expect(refreshSession()).resolves.toBe('access-2');
  });
});
