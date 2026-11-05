// frontend/src/services/__tests__/authService.logout.test.js
//
// PF-147 — sign-out asks the server, the only side that can remove the httpOnly
// cookie. Real `api` and `session`; only the network is scripted.
import { describe, it, expect, beforeEach } from 'vitest';
import { AxiosError } from 'axios';
import api from '../api';
import { authService } from '../authService';
import { session } from '../session';

const SIGNED_IN = { accessToken: 'a', refreshExpiresAt: '2099-01-01T00:00:00.000Z' };

let seen;
const answerWith = (handler) => {
  seen = [];
  api.defaults.adapter = async (config) => { seen.push(config); return handler(config); };
};

beforeEach(() => {
  localStorage.clear();
  session.clear();
});

describe('authService.logout', () => {
  it('asks the server with the cookie, sends no token, then forgets', async () => {
    session.set(SIGNED_IN);
    answerWith((config) => ({ data: {}, status: 200, statusText: 'OK', headers: {}, config }));

    await authService.logout();

    expect(seen[0].url).toBe('/auth/logout');
    expect(seen[0].withCredentials).toBe(true);
    expect(seen[0].data == null).toBe(true);
    expect(session.getAccessToken()).toBeNull();
    expect(session.probablySignedIn()).toBe(false);
  });

  it('asks even when nothing is stored: only the browser knows about the cookie', async () => {
    answerWith((config) => ({ data: {}, status: 200, statusText: 'OK', headers: {}, config }));
    await authService.logout();
    expect(seen).toHaveLength(1);
  });

  it('a call that fails rejects and forgets NOTHING: the key would still work', async () => {
    session.set(SIGNED_IN);
    answerWith((config) => { throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config); });

    await expect(authService.logout()).rejects.toBeDefined();

    expect(session.getAccessToken()).toBe('a');
    expect(session.probablySignedIn()).toBe(true);
  });

  it('login asks the browser to keep the cookie', async () => {
    answerWith((config) => ({ data: SIGNED_IN, status: 200, statusText: 'OK', headers: {}, config }));
    await authService.login('a@b.c', 'pw');
    expect(seen[0].withCredentials).toBe(true);
  });
});
