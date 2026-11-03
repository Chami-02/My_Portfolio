// frontend/src/utils/__tests__/loginError.test.js
import { describe, it, expect } from 'vitest';
import { loginErrorMessage, googleErrorMessage, googleExchangeErrorMessage } from '../loginError';
import { MESSAGES, JARGON } from '../friendlyError';

/**
 * The regression these guard is specific: a backend that is down must not
 * produce a message about the password. The old inline expression did
 * exactly that, and the resulting sentence was indistinguishable from a
 * genuine 401 except for a trailing "Please try again." that the API
 * never sends.
 */
describe('loginErrorMessage', () => {
  describe('no response — the request never reached a server', () => {
    // axios sets code ERR_NETWORK and leaves response undefined on a
    // connection refusal, which is precisely the "backend not running" case.
    // PF-144: plain words — no "server", no "backend" (utils/friendlyError.js).
    it('says the connection failed, not the credentials, on a network error', () => {
      const msg = loginErrorMessage({ code: 'ERR_NETWORK', message: 'Network Error' });

      expect(msg).toBe(MESSAGES.offline);
      expect(msg).not.toMatch(JARGON);
      // The whole point: it must not talk about the password.
      expect(msg).not.toMatch(/password/i);
      expect(msg).not.toMatch(/invalid email/i);
    });

    it('distinguishes a timeout from a refusal', () => {
      const msg = loginErrorMessage({ code: 'ECONNABORTED' });

      expect(msg).toBe(MESSAGES.slow);
      expect(msg).not.toMatch(/password/i);
    });

    // Defensive: a thrown non-axios value must not crash the catch block.
    it('survives an error with no shape at all', () => {
      expect(() => loginErrorMessage(undefined)).not.toThrow();
      expect(loginErrorMessage(undefined)).toBe(MESSAGES.offline);
    });
  });

  describe('with a response', () => {
    it('reports 401 as a credential failure', () => {
      const msg = loginErrorMessage({
        response: { status: 401, data: { message: 'Invalid email or password' } },
      });

      expect(msg).toBe('Incorrect email or password. Please try again.');
    });

    it('surfaces the server message on other statuses', () => {
      const msg = loginErrorMessage({
        response: { status: 429, data: { message: 'Too many attempts, slow down' } },
      });

      expect(msg).toBe('Too many attempts, slow down');
    });

    // A 500 with an empty body used to fall through to the credential
    // string — the same misdirection, one layer down.
    it('a problem on our side says so in plain words — never a status code, never the credentials', () => {
      const msg = loginErrorMessage({ response: { status: 500, data: {} } });

      expect(msg).toBe(MESSAGES.ourSide);
      expect(msg).not.toMatch(/500/);
      expect(msg).not.toMatch(/invalid email/i);
    });
  });
});

describe('googleErrorMessage (PF-119)', () => {
  it('gives each reason its own sentence', () => {
    const reasons = ['cancelled', 'not_allowed', 'expired', 'unavailable', 'failed'];
    const sentences = reasons.map(googleErrorMessage);
    expect(new Set(sentences).size).toBe(reasons.length);
  });

  it('points to the password door when Google is unavailable', () => {
    expect(googleErrorMessage('unavailable')).toMatch(/email and password/);
  });

  it.each([undefined, '', 'nonsense', 'toString', '__proto__', 'constructor'])(
    'falls back to the generic sentence for %p — never undefined, never a prototype member',
    (reason) => expect(googleErrorMessage(reason)).toBe(googleErrorMessage('failed')),
  );
});

describe('googleExchangeErrorMessage (PF-119)', () => {
  it('a 401 is an expired handoff — it never mentions a password', () => {
    const msg = googleExchangeErrorMessage({ response: { status: 401, data: {} } });
    expect(msg).toBe(googleErrorMessage('expired'));
    expect(msg).not.toMatch(/password/i);
  });

  it('any other HTTP failure is the generic sentence', () => {
    expect(googleExchangeErrorMessage({ response: { status: 500, data: {} } }))
      .toBe(googleErrorMessage('failed'));
  });

  it('no response reads exactly like the password form\'s connection message', () => {
    expect(googleExchangeErrorMessage({ code: 'ERR_NETWORK' })).toBe(MESSAGES.offline);
  });
});
