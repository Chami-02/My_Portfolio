// frontend/src/components/admin/panels/__tests__/SettingsSessionsCard.test.jsx
//
// PF-132 — the Settings Sessions card. The three auth calls are mocked at the
// SERVICE; the hooks, TanStack Query, the guard and ConfirmDialog are real, so
// "the list refetches after a sign-out" is tested through the real call path.
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSessions:      vi.fn(),
  endSession:       vi.fn(),
  endOtherSessions: vi.fn(),
  showFlash:        vi.fn(),
}));
vi.mock('../../../../services/authService', () => ({
  authService: {
    getSessions:      mocks.getSessions,
    endSession:       mocks.endSession,
    endOtherSessions: mocks.endOtherSessions,
  },
}));
vi.mock('../../../../hooks/useAdminFlash', () => ({
  useAdminFlash: () => ({ showFlash: mocks.showFlash }),
}));

const { SettingsSessionsCard } = await import('../SettingsSessionsCard');

const HOUR = 60 * 60 * 1000;
const ago  = (ms) => new Date(Date.now() - ms).toISOString();

// Newest first, as the server sends them — and THIS device is NOT first, so
// a card that skipped its own ordering fails.
const LAPTOP = Object.freeze({
  id: 'fam-laptop', current: false, device: 'Firefox on Windows', location: 'Colombo, Sri Lanka',
  signInMethod: 'google', signedInAs: 'pcgallege@gmail.com',
  startedAt: '2026-10-20T08:00:00.000Z', lastActiveAt: ago(3 * HOUR),
});
const ME = Object.freeze({
  id: 'fam-me', current: true, device: 'Chrome on macOS', location: null,
  signInMethod: 'password', signedInAs: 'pcgallege@gmail.com',
  startedAt: '2026-10-28T08:00:00.000Z', lastActiveAt: ago(0),
});
const OLD = Object.freeze({
  id: 'fam-old', current: false, device: null, location: null,
  signInMethod: null, signedInAs: null, startedAt: null, lastActiveAt: ago(2 * 24 * HOUR),
});

const PASSWORD = 'my password';
const serverError = (status, message) =>
  Object.assign(new Error(message), { response: { status, data: { message } } });

const renderCard = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}><SettingsSessionsCard /></QueryClientProvider>,
  );
};
const toggle  = () => screen.getByRole('button', { name: /MANAGE SESSIONS/ });
const body    = () => document.getElementById('settings-sessions-body');
/** Open the fold, as the owner would, once the list has loaded. */
const unfold  = async (user) => {
  await screen.findByText('Chrome on macOS');
  await user.click(toggle());
};
const rows    = () => within(screen.getByRole('list')).getAllByRole('listitem');
const dialog  = () => screen.getByRole('dialog');
const pwField = () => within(dialog()).getByLabelText('Your password');

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSessions.mockResolvedValue([LAPTOP, ME, OLD]);
  mocks.endSession.mockResolvedValue(undefined);
  mocks.endOtherSessions.mockResolvedValue(undefined);
});

// Owner, 2026-10-29: folds like the Password card — same classes, same slide.
describe('SettingsSessionsCard — the fold', () => {
  it('starts folded: one line, the list inert, the toggle not focused', async () => {
    renderCard();
    await screen.findByText('Chrome on macOS');           // fetched while folded

    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(toggle()).toHaveAttribute('aria-controls', 'settings-sessions-body');
    expect(body()).toHaveAttribute('inert');
    expect(toggle()).not.toHaveFocus();
  });

  it('opens and folds again; focus stays on the toggle', async () => {
    const user = userEvent.setup();
    renderCard();
    await unfold(user);

    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(body()).not.toHaveAttribute('inert');
    expect(toggle()).toHaveFocus();

    await user.click(toggle());
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(body()).toHaveAttribute('inert');
    expect(toggle()).toHaveFocus();
  });

  it("uses the Password card's fold classes — the two cannot drift", async () => {
    const user = userEvent.setup();
    renderCard();
    await screen.findByText('Chrome on macOS');
    const folded = body().className;
    await user.click(toggle());

    expect(body().className).not.toBe(folded);              // the open class is added
    expect(body().firstElementChild.className).toMatch(/collapseInner/);
    expect(toggle().className).toMatch(/disclosure/);
  });
});

describe('SettingsSessionsCard — the list', () => {
  it('lists every device, THIS one first and marked, with no button of its own', async () => {
    renderCard();
    await screen.findByText('Chrome on macOS');

    const [first, second] = rows();
    expect(first).toHaveTextContent('Chrome on macOS');
    expect(within(first).getByText('THIS DEVICE')).toBeInTheDocument();
    expect(within(first).queryByRole('button')).toBeNull();
    expect(within(second).getByRole('button', { name: 'SIGN OUT' })).toBeInTheDocument();
    expect(screen.getAllByText('THIS DEVICE')).toHaveLength(1);
  });

  it('shows method, place, first sign-in and last activity', async () => {
    renderCard();
    const laptop = (await screen.findByText('Firefox on Windows')).closest('li');

    expect(laptop).toHaveTextContent('Google · Colombo, Sri Lanka · SIGNED IN 20 OCT 2026 · ACTIVE 3 H AGO');
    expect(rows()[0]).toHaveTextContent('Password · SIGNED IN 28 OCT 2026 · ACTIVE NOW');
  });

  it('a session from before PF-132 says less rather than guessing', async () => {
    renderCard();
    const old = (await screen.findByText('Unknown device')).closest('li');
    expect(within(old).getByText('ACTIVE 2 DAYS AGO')).toBeInTheDocument();
    expect(old).not.toHaveTextContent(/SIGNED IN|Password|Google/);
  });

  it('offers SIGN OUT ALL OTHER SESSIONS only while there are others', async () => {
    mocks.getSessions.mockResolvedValue([ME]);
    renderCard();
    expect(await screen.findByText('No other device is signed in.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'SIGN OUT ALL OTHER SESSIONS' })).toBeNull();
  });

  it('a failed load shows LoadError — never "no other device"', async () => {
    mocks.getSessions.mockRejectedValue(new Error('Network Error'));
    renderCard();
    expect(await screen.findByText('COULDN’T LOAD SESSIONS')).toBeInTheDocument();
    expect(screen.queryByText('No other device is signed in.')).toBeNull();
    expect(screen.queryByText('Signed in now')).toBeNull();
  });

  it('paints nothing list-shaped while loading', () => {
    mocks.getSessions.mockReturnValue(new Promise(() => {}));
    renderCard();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByText('No other device is signed in.')).toBeNull();
  });
});

describe('SettingsSessionsCard — signing out needs the password', () => {
  it('one device: asks, focuses the password, sends id + password, refetches, flashes', async () => {
    const user = userEvent.setup();
    renderCard();
    await unfold(user);
    await user.click(within((await screen.findByText('Firefox on Windows')).closest('li'))
      .getByRole('button', { name: 'SIGN OUT' }));

    expect(within(dialog()).getByText('Sign out Firefox on Windows?')).toBeInTheDocument();
    expect(pwField()).toHaveFocus();

    mocks.getSessions.mockResolvedValue([ME, OLD]);
    await user.type(pwField(), PASSWORD);
    await user.click(within(dialog()).getByRole('button', { name: 'SIGN OUT' }));

    expect(mocks.endSession).toHaveBeenCalledWith({ id: 'fam-laptop', password: PASSWORD });
    expect(mocks.endOtherSessions).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(mocks.showFlash).toHaveBeenCalledWith('Signed out Firefox on Windows');
    await waitFor(() => expect(screen.queryByText('Firefox on Windows')).toBeNull());
  });

  it('every other device: one call with the password only', async () => {
    const user = userEvent.setup();
    renderCard();
    await unfold(user);
    await user.click(await screen.findByRole('button', { name: 'SIGN OUT ALL OTHER SESSIONS' }));

    expect(within(dialog()).getByText('Sign out every other session?')).toBeInTheDocument();
    await user.type(pwField(), `${PASSWORD}{Enter}`);           // Enter submits

    expect(mocks.endOtherSessions).toHaveBeenCalledWith({ password: PASSWORD });
    expect(mocks.endSession).not.toHaveBeenCalled();
    expect(mocks.showFlash).toHaveBeenCalledWith('Signed out every other session');
  });

  it('a blank password is refused on the field — no request', async () => {
    const user = userEvent.setup();
    renderCard();
    await unfold(user);
    await user.click(await screen.findByRole('button', { name: 'SIGN OUT ALL OTHER SESSIONS' }));
    await user.click(within(dialog()).getByRole('button', { name: 'SIGN OUT' }));

    expect(mocks.endOtherSessions).not.toHaveBeenCalled();
    expect(pwField()).toHaveAttribute('aria-invalid', 'true');
    expect(within(dialog()).getByText('Enter your password.')).toBeInTheDocument();

    await user.type(pwField(), 'x');                            // the mark clears on keystroke
    expect(pwField()).not.toHaveAttribute('aria-invalid');
  });

  it("a wrong password shows the server's words and keeps the dialog open", async () => {
    mocks.endOtherSessions.mockRejectedValue(serverError(400, 'Your password is wrong.'));
    const user = userEvent.setup();
    renderCard();
    await unfold(user);
    await user.click(await screen.findByRole('button', { name: 'SIGN OUT ALL OTHER SESSIONS' }));
    await user.type(pwField(), `${PASSWORD}{Enter}`);

    expect(await within(dialog()).findByRole('alert')).toHaveTextContent('Your password is wrong.');
    expect(mocks.showFlash).not.toHaveBeenCalled();
  });

  it('a device that had already ended (404) leaves the list', async () => {
    mocks.endSession.mockRejectedValue(serverError(404, 'That session has already ended.'));
    const user = userEvent.setup();
    renderCard();
    await unfold(user);
    await user.click(within((await screen.findByText('Firefox on Windows')).closest('li'))
      .getByRole('button', { name: 'SIGN OUT' }));
    mocks.getSessions.mockResolvedValue([ME]);
    await user.type(pwField(), `${PASSWORD}{Enter}`);

    expect(await within(dialog()).findByRole('alert')).toHaveTextContent('That session has already ended.');
    await waitFor(() => expect(mocks.getSessions).toHaveBeenCalledTimes(2));
  });

  it('CANCEL closes without a request; reopening starts clean', async () => {
    const user = userEvent.setup();
    renderCard();
    await unfold(user);
    await user.click(await screen.findByRole('button', { name: 'SIGN OUT ALL OTHER SESSIONS' }));
    await user.type(pwField(), PASSWORD);
    await user.click(within(dialog()).getByRole('button', { name: 'CANCEL' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'SIGN OUT ALL OTHER SESSIONS' }));
    expect(pwField()).toHaveValue('');
    expect(mocks.endOtherSessions).not.toHaveBeenCalled();
  });

  it('every button in the card is type="button" (a form inside must not submit by accident)', async () => {
    const user = userEvent.setup();
    renderCard();
    await unfold(user);
    await user.click(await screen.findByRole('button', { name: 'SIGN OUT ALL OTHER SESSIONS' }));
    for (const b of screen.getAllByRole('button')) expect(b).toHaveAttribute('type', 'button');
  });
});
