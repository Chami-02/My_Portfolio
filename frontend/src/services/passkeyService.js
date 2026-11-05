import { startAuthentication, startRegistration, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import api, { WITH_COOKIE } from './api';
import { session, ME_KEY }  from './session';
import { queryClient }      from '../lib/queryClient';

/**
 * PF-140 — passkeys. Its own file, not authService: only the two lazy admin
 * pages import this, so the library never reaches a public page's bundle. A
 * static import, not `import()` at the press: a browser may refuse the prompt
 * once too long has passed since the press, so nothing extra waits in between.
 */
export const passkeySupported = () => browserSupportsWebAuthn();

export const passkeyService = {
  /**
   * The sign-in button: ask for a challenge, let the device sign it, trade the
   * answer for a session. Stored exactly as `login` stores one: there is ONE
   * session model, whichever door was used.
   */
  signIn: async () => {
    const { data: asked } = await api.post('/auth/passkey/login/options', undefined, WITH_COOKIE);
    const answer = await startAuthentication({ optionsJSON: asked.options });
    const { data } = await api.post('/auth/passkey/login/verify', answer, WITH_COOKIE);
    session.set(data);
    queryClient.removeQueries({ queryKey: ME_KEY });
    return data;
  },

  list: () => api.get('/auth/passkeys').then((r) => r.data.data),

  /** Adding, step one: the password buys the device's instructions. */
  prepareAdd: ({ password }) =>
    api.post('/auth/passkey/register/options', { password }).then((r) => r.data.options),

  /** Adding, step two: called from its own press (see the Settings card). */
  finishAdd: async (options) => {
    const credential = await startRegistration({ optionsJSON: options });
    const { data } = await api.post('/auth/passkey/register/verify', { credential });
    return data.data;
  },

  remove: ({ id, password }) =>
    api.post('/auth/passkeys/remove', { id, password }).then(() => undefined),
};
