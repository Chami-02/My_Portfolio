// frontend/src/services/__tests__/session.test.js
//
// PF-108 — the browser-side session store. First test under services/;
// the directory follows the per-module __tests__ convention.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { session } from '../session';

const PAIR = {
  accessToken:      'access.jwt.value',
  refreshToken:     'r'.repeat(43),
  accessExpiresAt:  '2026-09-16T10:15:00.000Z',
  refreshExpiresAt: '2026-09-23T10:00:00.000Z',
};

beforeEach(() => {
  localStorage.clear();
  session.clear();
});

describe('session store — where each token lives', () => {
  it('keeps the access token in memory and OUT of localStorage', () => {
    session.set(PAIR);

    expect(session.getAccessToken()).toBe(PAIR.accessToken);
    // The whole point: nothing in storage carries the access token.
    const stored = ['portfolio_refresh', 'portfolio_refresh_expires', 'portfolio_token']
      .map((k) => localStorage.getItem(k))
      .join('|');
    expect(stored).not.toContain(PAIR.accessToken);
    expect(localStorage.getItem('portfolio_token')).toBeNull();
  });

  it('persists the refresh token and its expiry so a reload can renew', () => {
    session.set(PAIR);

    expect(localStorage.getItem('portfolio_refresh')).toBe(PAIR.refreshToken);
    expect(session.getRefreshToken()).toBe(PAIR.refreshToken);
    expect(session.getRefreshExpiresAt()).toBe(Date.parse(PAIR.refreshExpiresAt));
    expect(session.getAccessExpiresAt()).toBe(Date.parse(PAIR.accessExpiresAt));
    expect(session.hasRefreshToken()).toBe(true);
  });

  it('clear() forgets both halves', () => {
    session.set(PAIR);
    session.clear();

    expect(session.getAccessToken()).toBeNull();
    expect(session.getRefreshToken()).toBeNull();
    expect(session.getRefreshExpiresAt()).toBeNull();
    expect(session.hasRefreshToken()).toBe(false);
  });

  it('a payload with no refresh token updates the access half only', () => {
    session.set(PAIR);
    session.set({ accessToken: 'newer', accessExpiresAt: '2026-09-16T10:30:00.000Z' });

    expect(session.getAccessToken()).toBe('newer');
    expect(session.getRefreshToken()).toBe(PAIR.refreshToken);
  });

  it('treats an unparseable expiry as unknown rather than NaN', () => {
    session.set({ ...PAIR, refreshExpiresAt: 'not a date', accessExpiresAt: 'nope' });
    expect(session.getRefreshExpiresAt()).toBeNull();
    expect(session.getAccessExpiresAt()).toBeNull();
    // …and a corrupted stored value reads back as unknown too
    localStorage.setItem('portfolio_refresh_expires', 'garbage');
    expect(session.getRefreshExpiresAt()).toBeNull();
  });
});

describe('session store — subscribers', () => {
  it('notifies on set and on clear, and stops after unsubscribe', () => {
    const fn = vi.fn();
    const off = session.subscribe(fn);

    session.set(PAIR);
    session.clear();
    expect(fn).toHaveBeenCalledTimes(2);

    off();
    session.set(PAIR);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('session store — storage that throws', () => {
  // Private mode, storage disabled, quota: every localStorage call can
  // throw. The session must degrade to "ends on reload", not crash.
  it('survives a localStorage that throws on every call', () => {
    const throwing = {
      getItem:    () => { throw new Error('denied'); },
      setItem:    () => { throw new Error('denied'); },
      removeItem: () => { throw new Error('denied'); },
    };
    const real = window.localStorage;
    Object.defineProperty(window, 'localStorage', { value: throwing, configurable: true });
    try {
      expect(() => session.set(PAIR)).not.toThrow();
      expect(session.getAccessToken()).toBe(PAIR.accessToken);   // memory half still works
      expect(session.getRefreshToken()).toBeNull();
      expect(session.hasRefreshToken()).toBe(false);
      expect(() => session.clear()).not.toThrow();
    } finally {
      Object.defineProperty(window, 'localStorage', { value: real, configurable: true });
    }
  });
});
