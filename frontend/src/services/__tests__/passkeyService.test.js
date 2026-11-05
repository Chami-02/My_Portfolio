// frontend/src/services/__tests__/passkeyService.test.js
//
// PF-140 — the browser's half of passkeys. Through the REAL axios instance with
// a scripted adapter (api.test.js's precedent), so what is asserted is the
// request that would actually leave the browser. Only the device is replaced.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const device = vi.hoisted(() => ({
  startAuthentication: vi.fn(),
  startRegistration:   vi.fn(),
  browserSupportsWebAuthn: vi.fn(),
}));
vi.mock('@simplewebauthn/browser', () => device);

const { default: api } = await import('../api');
const { session, ME_KEY } = await import('../session');
const { passkeyService, passkeySupported } = await import('../passkeyService');
const { queryClient } = await import('../../lib/queryClient');

const OPTIONS = Object.freeze({ challenge: 'abc' });
const SESSION = Object.freeze({
  status: 'success',
  accessToken: 'access-p',
  accessExpiresAt: new Date(Date.now() + 900e3).toISOString(),
  refreshExpiresAt: new Date(Date.now() + 7 * 864e5).toISOString(),
  data: { id: 'u1', email: 'pcgallege@gmail.com', role: 'admin' },
});

const calls = [];
const originalAdapter = api.defaults.adapter;
const script = (answers) => {
  api.defaults.adapter = async (config) => {
    calls.push(config);
    const data = answers[config.url];
    return { data, status: 200, statusText: 'OK', headers: {}, config };
  };
};

beforeEach(() => {
  calls.length = 0;
  session.clear();
  vi.resetAllMocks();
});
afterEach(() => {
  api.defaults.adapter = originalAdapter;
  session.clear();
  queryClient.clear();
});

describe('signing in', () => {
  const answers = {
    '/auth/passkey/login/options': { options: OPTIONS },
    '/auth/passkey/login/verify':  SESSION,
  };

  it('asks, lets the device sign, sends the answer, both with the cookie', async () => {
    script(answers);
    device.startAuthentication.mockResolvedValue({ id: 'cred' });
    await passkeyService.signIn();

    expect(calls.map((c) => c.url)).toEqual(['/auth/passkey/login/options', '/auth/passkey/login/verify']);
    expect(calls.every((c) => c.withCredentials === true)).toBe(true);
    expect(device.startAuthentication).toHaveBeenCalledWith({ optionsJSON: OPTIONS });
    expect(JSON.parse(calls[1].data)).toEqual({ id: 'cred' });
  });

  it('stores the session exactly as the other doors do, and forgets a stale "signed out"', async () => {
    script(answers);
    device.startAuthentication.mockResolvedValue({ id: 'cred' });
    queryClient.setQueryData(ME_KEY, null);
    await passkeyService.signIn();

    expect(session.getAccessToken()).toBe('access-p');
    expect(queryClient.getQueryState(ME_KEY)).toBeUndefined();
  });

  it('a closed prompt sends nothing further and stores nothing', async () => {
    script(answers);
    device.startAuthentication.mockRejectedValue(Object.assign(new Error('x'), { name: 'NotAllowedError' }));

    await expect(passkeyService.signIn()).rejects.toMatchObject({ name: 'NotAllowedError' });
    expect(calls).toHaveLength(1);
    expect(session.getAccessToken()).toBeFalsy();
  });
});

describe('adding and removing', () => {
  it('adding sends the password first and no cookie: these calls are Bearer only', async () => {
    script({ '/auth/passkey/register/options': { options: OPTIONS } });
    expect(await passkeyService.prepareAdd({ password: 'secret' })).toEqual(OPTIONS);
    expect(JSON.parse(calls[0].data)).toEqual({ password: 'secret' });
    expect(calls[0].withCredentials).toBeFalsy();
    expect(device.startRegistration).not.toHaveBeenCalled();
  });

  it('finishing hands the device its instructions and sends the credential on', async () => {
    script({ '/auth/passkey/register/verify': { data: { id: 'p1' } } });
    device.startRegistration.mockResolvedValue({ id: 'cred' });
    expect(await passkeyService.finishAdd(OPTIONS)).toEqual({ id: 'p1' });
    expect(device.startRegistration).toHaveBeenCalledWith({ optionsJSON: OPTIONS });
    expect(JSON.parse(calls[0].data)).toEqual({ credential: { id: 'cred' } });
  });

  it('removing sends the id and the password', async () => {
    script({ '/auth/passkeys/remove': { status: 'success' } });
    await passkeyService.remove({ id: 'p1', password: 'secret' });
    expect(JSON.parse(calls[0].data)).toEqual({ id: 'p1', password: 'secret' });
  });
});

describe('passkeySupported', () => {
  it.each([true, false])('follows the browser (%s)', (answer) => {
    device.browserSupportsWebAuthn.mockReturnValue(answer);
    expect(passkeySupported()).toBe(answer);
  });
});
