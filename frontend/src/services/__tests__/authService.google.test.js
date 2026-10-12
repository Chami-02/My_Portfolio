// frontend/src/services/__tests__/authService.google.test.js
//
// PF-119 — the browser's half of Google sign-in. Driven through the REAL
// axios instance with a scripted adapter (api.test.js's precedent), so what
// is asserted is the request that would actually leave the browser and the
// real session store it writes into.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import api from '../api';
import { session, ME_KEY } from '../session';
import { authService } from '../authService';
import { queryClient } from '../../lib/queryClient';

const calls = [];
const originalAdapter = api.defaults.adapter;

const PAYLOAD = {
  status: 'success',
  accessToken: 'access-g', refreshToken: 'refresh-g',
  accessExpiresAt: new Date(Date.now() + 900e3).toISOString(),
  refreshExpiresAt: new Date(Date.now() + 7 * 864e5).toISOString(),
  data: { id: 'u1', email: 'pcgallege@gmail.com', role: 'admin' },
  returnTo: '/admin?tab=blog',
};

beforeEach(() => {
  calls.length = 0;
  session.clear();
  api.defaults.adapter = async (config) => {
    calls.push(config);
    return { data: PAYLOAD, status: 200, statusText: 'OK', headers: {}, config };
  };
});
afterEach(() => {
  api.defaults.adapter = originalAdapter;
  session.clear();
  queryClient.clear();
});

describe('authService.googleStartUrl', () => {
  it('points at the API\'s start route and URL-encodes the destination', () => {
    const url = authService.googleStartUrl('/admin?tab=blog#x');
    expect(url).toMatch(/\/auth\/google\/start\?returnTo=%2Fadmin%3Ftab%3Dblog%23x$/);
  });
});

describe('authService.googleExchange', () => {
  it('POSTs the one-time code and nothing else', async () => {
    await authService.googleExchange('one-time');
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('post');
    expect(calls[0].url).toBe('/auth/google/exchange');
    expect(JSON.parse(calls[0].data)).toEqual({ code: 'one-time' });
  });

  it('stores the session exactly as password login does', async () => {
    await authService.googleExchange('one-time');
    expect(session.getRefreshToken()).toBe('refresh-g');
    expect(session.getAccessToken()).toBe('access-g');
  });

  it('clears a cached "signed out" so ProtectedRoute does not bounce back', async () => {
    queryClient.setQueryData(ME_KEY, null);
    await authService.googleExchange('one-time');
    expect(queryClient.getQueryData(ME_KEY)).toBeUndefined();
  });

  it('resolves to where the admin was going', async () => {
    await expect(authService.googleExchange('one-time')).resolves.toBe('/admin?tab=blog');
  });
});
