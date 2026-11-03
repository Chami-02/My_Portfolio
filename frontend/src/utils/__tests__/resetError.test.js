// PF-125 — the forgot-password page's failure sentences.
import { describe, it, expect } from 'vitest';
import { resetErrorMessage } from '../resetError';
import { MESSAGES } from '../friendlyError';

describe('resetErrorMessage', () => {
  it('shows the server\'s own sentence (a wrong code, a short password, a leak, a 429)', () => {
    const message = 'That code is wrong or has expired. Check it, or request a new one.';
    expect(resetErrorMessage({ response: { status: 400, data: { message } } })).toBe(message);
    const limited = 'Too many reset attempts. Please wait 15 minutes before trying again.';
    expect(resetErrorMessage({ response: { status: 429, data: { message: limited } } })).toBe(limited);
  });

  // PF-144: plain words (utils/friendlyError.js) — no "server", no status code.
  it('no response: says the connection failed — never blames the code', () => {
    const text = resetErrorMessage(new Error('Network Error'));
    expect(text).toBe(MESSAGES.offline);
    expect(text).not.toMatch(/code/i);
  });

  it('a problem on our side says so plainly, never "HTTP 502"', () => {
    expect(resetErrorMessage({ response: { status: 502 } })).toBe(MESSAGES.ourSide);
  });
});
