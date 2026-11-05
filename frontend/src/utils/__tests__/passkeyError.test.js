// frontend/src/utils/__tests__/passkeyError.test.js — PF-140.
import { describe, it, expect } from 'vitest';
import { passkeyCancelled, passkeySignInMessage, passkeyAddMessage } from '../passkeyError';
import { JARGON } from '../friendlyError';

const device = (name) => Object.assign(new Error('technical words'), { name });
const answer = (status, message) =>
  Object.assign(new Error('x'), { isAxiosError: true, response: { status, data: { message } } });
const noAnswer = Object.assign(new Error('x'), { isAxiosError: true });

describe('passkeyCancelled', () => {
  it.each(['NotAllowedError', 'AbortError'])('%s from the device is a cancel', (name) => {
    expect(passkeyCancelled(device(name))).toBe(true);
  });

  it('a device failure of another kind is not', () => {
    expect(passkeyCancelled(device('SecurityError'))).toBe(false);
  });

  it('a request failure is never a cancel, whatever it is called', () => {
    expect(passkeyCancelled(Object.assign(answer(401, 'x'), { name: 'NotAllowedError' }))).toBe(false);
  });
});

describe('the messages', () => {
  it('sign-in: a refused passkey shows the server\'s sentence, not the password message', () => {
    const said = "We couldn't sign you in with that passkey. Please try again, or use your password or Google.";
    expect(passkeySignInMessage(answer(401, said))).toBe(said);
  });

  it('sign-in: no answer says the connection, not the passkey', () => {
    expect(passkeySignInMessage(noAnswer)).toMatch(/connect/);
  });

  it('a device failure is never reported as the connection', () => {
    expect(passkeySignInMessage(device('SecurityError'))).not.toMatch(/connect/);
    expect(passkeyAddMessage(device('SecurityError'))).not.toMatch(/connect/);
  });

  it('adding: a duplicate on this device says so', () => {
    expect(passkeyAddMessage(device('InvalidStateError'))).toMatch(/already has a passkey/);
  });

  it.each([
    ['sign-in', passkeySignInMessage],
    ['add', passkeyAddMessage],
  ])('%s: no device error name or jargon reaches the reader', (_n, message) => {
    ['NotAllowedError', 'AbortError', 'InvalidStateError', 'SecurityError', 'TypeError'].forEach((name) => {
      const text = message(device(name));
      expect(text).not.toMatch(/technical words/);
      expect(text).not.toMatch(JARGON);
    });
  });
});
