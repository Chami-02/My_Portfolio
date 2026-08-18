// frontend/src/utils/__tests__/loginError.test.js
import { describe, it, expect } from 'vitest';
import { loginErrorMessage } from '../loginError';

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
    it('names the server, not the credentials, on a network error', () => {
      const msg = loginErrorMessage({ code: 'ERR_NETWORK', message: 'Network Error' });

      expect(msg).toMatch(/cannot reach the server/i);
      expect(msg).toMatch(/backend/i);
      // The whole point: it must not talk about the password.
      expect(msg).not.toMatch(/password/i);
      expect(msg).not.toMatch(/invalid email/i);
    });

    it('distinguishes a timeout from a refusal', () => {
      const msg = loginErrorMessage({ code: 'ECONNABORTED' });

      expect(msg).toMatch(/took too long/i);
      expect(msg).not.toMatch(/password/i);
    });

    // Defensive: a thrown non-axios value must not crash the catch block.
    it('survives an error with no shape at all', () => {
      expect(() => loginErrorMessage(undefined)).not.toThrow();
      expect(loginErrorMessage(undefined)).toMatch(/cannot reach the server/i);
    });
  });

  describe('with a response', () => {
    it('reports 401 as a credential failure', () => {
      const msg = loginErrorMessage({
        response: { status: 401, data: { message: 'Invalid email or password' } },
      });

      expect(msg).toBe('Invalid email or password. Please try again.');
    });

    it('surfaces the server message on other statuses', () => {
      const msg = loginErrorMessage({
        response: { status: 429, data: { message: 'Too many attempts, slow down' } },
      });

      expect(msg).toBe('Too many attempts, slow down');
    });

    // A 500 with an empty body used to fall through to the credential
    // string — the same misdirection, one layer down.
    it('falls back to the status code, never to a credential message', () => {
      const msg = loginErrorMessage({ response: { status: 500, data: {} } });

      expect(msg).toMatch(/HTTP 500/);
      expect(msg).not.toMatch(/invalid email/i);
    });
  });
});
