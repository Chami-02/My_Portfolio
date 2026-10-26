// PF-125 — the forgot-password page's failure sentences.
import { describe, it, expect } from 'vitest';
import { resetErrorMessage } from '../resetError';

describe('resetErrorMessage', () => {
  it('shows the server\'s own sentence (a wrong code, a short password, a leak, a 429)', () => {
    const message = 'That code is wrong or has expired. Check it, or request a new one.';
    expect(resetErrorMessage({ response: { status: 400, data: { message } } })).toBe(message);
    const limited = 'Too many reset attempts. Please wait 15 minutes before trying again.';
    expect(resetErrorMessage({ response: { status: 429, data: { message: limited } } })).toBe(limited);
  });

  it('no response: says the server is unreachable — never blames the code', () => {
    const text = resetErrorMessage(new Error('Network Error'));
    expect(text).toMatch(/cannot reach the server/i);
    expect(text).not.toMatch(/code/i);
  });

  it('a response with no message falls back to the status', () => {
    expect(resetErrorMessage({ response: { status: 502 } })).toMatch(/HTTP 502/);
  });
});
