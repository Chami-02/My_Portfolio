// frontend/src/components/admin/__tests__/SessionExpiryBanner.test.jsx
//
// PF-108 — the idle-session warning. Fake timers throughout: the banner is
// driven by a real clock in production, and the thing under test is WHEN it
// appears, which a wall clock cannot assert in a test's lifetime.
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const refresh = vi.hoisted(() => vi.fn());
vi.mock('../../../services/authService', () => ({ authService: { refresh } }));

const { SessionExpiryBanner } = await import('../SessionExpiryBanner');
const { session }             = await import('../../../services/session');

const MIN = 60 * 1000;
const T0  = Date.parse('2026-09-16T10:00:00.000Z');

const storeExpiring = (msFromNow) =>
  session.set({
    accessToken:      'a',
    refreshToken:     'r',
    accessExpiresAt:  new Date(Date.now() + 15 * MIN).toISOString(),
    refreshExpiresAt: new Date(Date.now() + msFromNow).toISOString(),
  });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  localStorage.clear();
  session.clear();
  refresh.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SessionExpiryBanner', () => {
  it('renders nothing with no session', () => {
    const { container } = render(<SessionExpiryBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing while more than five minutes remain', () => {
    storeExpiring(6 * MIN);
    const { container } = render(<SessionExpiryBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('appears at five minutes to go, WITHOUT a re-render from outside', () => {
    // The banner wakes itself: the effect arms a timer for the exact warn
    // instant, so an idle tab with nothing else happening still warns.
    storeExpiring(6 * MIN);
    const { container } = render(<SessionExpiryBanner />);
    expect(container).toBeEmptyDOMElement();

    act(() => { vi.advanceTimersByTime(1 * MIN + 100); });

    expect(screen.getByRole('status')).toHaveTextContent(/session ends in 5 min/i);
    expect(screen.getByRole('button', { name: 'STAY SIGNED IN' })).toBeInTheDocument();
  });

  it('is visible immediately when mounted inside the window', () => {
    storeExpiring(2 * MIN);
    render(<SessionExpiryBanner />);
    expect(screen.getByRole('status')).toHaveTextContent(/2 min/i);
  });

  it('rounds up — never says 0 MIN while there is time left', () => {
    storeExpiring(20 * 1000);
    render(<SessionExpiryBanner />);
    expect(screen.getByRole('status')).toHaveTextContent(/1 min/i);
  });

  it('goes away once the session has actually expired', () => {
    storeExpiring(2 * MIN);
    const { container } = render(<SessionExpiryBanner />);
    expect(screen.getByRole('status')).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(2 * MIN + 100); });

    expect(container).toBeEmptyDOMElement();
  });

  it('STAY SIGNED IN calls refresh, and the banner dismisses when the store moves', async () => {
    storeExpiring(3 * MIN);
    // A real refresh writes the rotated pair into the store; the mock does
    // the same so the assertion is about the banner reacting to the STORE,
    // not to the click.
    refresh.mockImplementation(async () => { storeExpiring(7 * 24 * 60 * MIN); });
    render(<SessionExpiryBanner />);

    await act(async () => {
      screen.getByRole('button', { name: 'STAY SIGNED IN' }).click();
    });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('a rotation that happens ELSEWHERE (api.js silent refresh) dismisses it too', () => {
    storeExpiring(3 * MIN);
    render(<SessionExpiryBanner />);
    expect(screen.getByRole('status')).toBeInTheDocument();

    act(() => { storeExpiring(7 * 24 * 60 * MIN); });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('a failed renewal does not crash the banner', async () => {
    storeExpiring(3 * MIN);
    refresh.mockRejectedValue(new Error('dead'));
    render(<SessionExpiryBanner />);

    await act(async () => {
      screen.getByRole('button', { name: 'STAY SIGNED IN' }).click();
    });

    expect(refresh).toHaveBeenCalledTimes(1);
    // Still mounted, button re-enabled — ProtectedRoute owns the exit.
    expect(screen.getByRole('button', { name: 'STAY SIGNED IN' })).toBeEnabled();
  });
});
