// frontend/src/components/admin/panels/__tests__/SettingsPasswordCard.test.jsx
//
// PF-124 — the Settings Password card: current password + new password →
// SEND CODE → the emailed code → SAVE NEW PASSWORD. The two auth calls are
// mocked at the service; everything else (guard, validator, leave dialog) is
// the real thing.
import { screen, within, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithGuard } from '../../../../test/renderWithGuard';

const mocks = vi.hoisted(() => ({
  requestPasswordChangeCode: vi.fn(),
  changePassword: vi.fn(),
  showFlash: vi.fn(),
  me: null,
}));
vi.mock('../../../../services/authService', () => ({
  authService: {
    requestPasswordChangeCode: mocks.requestPasswordChangeCode,
    changePassword: mocks.changePassword,
  },
}));
vi.mock('../../../../hooks/useAdminFlash', () => ({
  useAdminFlash: () => ({ showFlash: mocks.showFlash }),
}));
// The strength words: this account's addresses and the About name.
vi.mock('../../../../hooks/useMe', () => ({
  useMe: () => ({ data: mocks.me }),
}));
vi.mock('../../../../hooks/useAbout', () => ({ useAbout: () => ({ data: { name: 'Parindra Gallage' } }) }));

const { SettingsPasswordCard } = await import('../SettingsPasswordCard');

const CURRENT = 'the current one';
const NEW     = 'a long new pass phrase';
const SENT_TO = 'parindrachameekara@gmail.com';

const button = (name) => screen.getByRole('button', { name });
const serverError = (status, message) =>
  Object.assign(new Error(message), { response: { status, data: { message } } });

/** Fill step one with valid values (or overrides) and press SEND CODE. */
async function fillPasswords(user, { current = CURRENT, password = NEW, confirm = password } = {}) {
  if (current)  await user.type(screen.getByLabelText('Current password'), current);
  if (password) await user.type(screen.getByLabelText('New password'), password);
  if (confirm)  await user.type(screen.getByLabelText('Repeat new password'), confirm);
  await user.click(button('SEND CODE'));
}

const toggle = () => screen.getByRole('button', { name: /CHANGE PASSWORD/ });

// A real QueryClient: a finished change invalidates `/auth/me` and the
// sign-in history (PF-133) — the spy proves which.
let qc;
const renderCard = () => renderWithGuard(
  <QueryClientProvider client={qc}><SettingsPasswordCard /></QueryClientProvider>,
);

/** Render inside the leave guard and open the fold, as the owner would. */
async function renderOpen(user) {
  const rendered = renderCard();
  await user.click(toggle());
  return rendered;
}

beforeEach(() => {
  vi.clearAllMocks();
  qc = new QueryClient();
  mocks.me = { email: 'pcgallege@gmail.com', addresses: [{ address: 'pcgallege@gmail.com' }] };
  mocks.requestPasswordChangeCode.mockResolvedValue(SENT_TO);
  mocks.changePassword.mockResolvedValue('Password changed. Every other device was signed out.');
});

describe('SettingsPasswordCard — the fold (owner, 2026-10-27)', () => {
  it('starts folded: one line, the form inert, nothing focused', () => {
    renderCard();
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    const body = document.getElementById(toggle().getAttribute('aria-controls'));
    expect(body).toHaveAttribute('inert');
    expect(body).toContainElement(screen.getByLabelText('Current password'));
    expect(document.body).toHaveFocus();
  });

  it('opens on press, and moves focus to Current password', async () => {
    const user = userEvent.setup();
    await renderOpen(user);
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById(toggle().getAttribute('aria-controls'))).not.toHaveAttribute('inert');
    await waitFor(() => expect(screen.getByLabelText('Current password')).toHaveFocus());
  });

  it('an untouched form folds at once, focus back on the button', async () => {
    const user = userEvent.setup();
    await renderOpen(user);
    await user.click(toggle());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(toggle()).toHaveFocus());
  });

  it('a half-typed form asks before folding — KEEP keeps it, DISCARD empties and folds', async () => {
    const user = userEvent.setup();
    await renderOpen(user);
    await user.type(screen.getByLabelText('Current password'), 'x');

    await user.click(toggle());
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /KEEP/ }));
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Current password')).toHaveValue('x');

    await user.click(toggle());
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /DISCARD/ }));
    await waitFor(() => expect(toggle()).toHaveAttribute('aria-expanded', 'false'));
    expect(screen.getByLabelText('Current password')).toHaveValue('');
  });
});

describe('SettingsPasswordCard — step one', () => {
  it('SEND CODE is dim until something is typed', async () => {
    const user = userEvent.setup();
    await renderOpen(user);
    expect(button('SEND CODE')).toBeDisabled();
    await user.type(screen.getByLabelText('Current password'), 'x');
    expect(button('SEND CODE')).not.toBeDisabled();
  });

  it('sends the current and new password, then shows the code step naming the address', async () => {
    const user = userEvent.setup();
    await renderOpen(user);
    await fillPasswords(user);

    expect(mocks.requestPasswordChangeCode).toHaveBeenCalledWith(
      expect.objectContaining({ currentPassword: CURRENT, password: NEW }),
    );
    expect(await screen.findByLabelText('6-digit code')).toBeInTheDocument();
    expect(screen.getByText(SENT_TO)).toBeInTheDocument();
    expect(screen.queryByLabelText('Current password')).toBeNull();
  });

  it('refuses an invalid form: no request, every field marked, the first focused', async () => {
    const user = userEvent.setup();
    await renderOpen(user);
    await fillPasswords(user, { current: '', password: 'too short', confirm: 'different' });

    expect(mocks.requestPasswordChangeCode).not.toHaveBeenCalled();
    expect(screen.getByText(/CHECK THE CHANGES AGAIN — 3 fields need attention/)).toBeInTheDocument();
    for (const label of ['Current password', 'New password', 'Repeat new password']) {
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true');
    }
    expect(screen.getByText('Too short — at least 15 characters.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Current password')).toHaveFocus());
  });

  it('a new password equal to the current one is refused before any request', async () => {
    const user = userEvent.setup();
    await renderOpen(user);
    await fillPasswords(user, { current: NEW, password: NEW });
    expect(mocks.requestPasswordChangeCode).not.toHaveBeenCalled();
    expect(screen.getByText('Must be different from your current password.')).toBeInTheDocument();
  });

  it('typing in a marked field clears ITS mark only', async () => {
    const user = userEvent.setup();
    await renderOpen(user);
    await fillPasswords(user, { current: '', password: 'too short', confirm: 'different' });
    await user.type(screen.getByLabelText('Current password'), 'x');
    expect(screen.getByLabelText('Current password')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText('New password')).toHaveAttribute('aria-invalid', 'true');
  });

  it("shows the server's refusal in its own line and stays on step one", async () => {
    mocks.requestPasswordChangeCode.mockRejectedValueOnce(serverError(400, 'Your current password is wrong.'));
    const user = userEvent.setup();
    await renderOpen(user);
    await fillPasswords(user);

    expect(await screen.findByText('Your current password is wrong.')).toBeInTheDocument();
    expect(screen.getByLabelText('Current password')).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByLabelText('6-digit code')).toBeNull();
  });

  it('one eye shows the current password; another shows both new ones', async () => {
    const user = userEvent.setup();
    await renderOpen(user);
    const [currentEye, newEye] = screen.getAllByRole('button', { name: 'Show password' });
    expect(currentEye).toHaveAttribute('type', 'button');

    await user.click(newEye);
    expect(newEye).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('New password')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Repeat new password')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Current password')).toHaveAttribute('type', 'password');
  });
});

describe('SettingsPasswordCard — strength meter (PF-124 follow-up)', () => {
  it('shows the live strength under New password', async () => {
    const user = userEvent.setup();
    await renderOpen(user);
    await user.type(screen.getByLabelText('New password', { exact: true }), NEW);
    expect(await screen.findByText('Strength: Strong.')).toBeInTheDocument();
  });

  it('refuses a weak password before any request, with the reason marked on the field', async () => {
    const user = userEvent.setup();
    await renderOpen(user);
    await screen.findByLabelText('Current password');
    await user.type(screen.getByLabelText('New password', { exact: true }), 'qwertyuiopasdfg');
    await screen.findByText(/Strength: Weak\./);
    await fillPasswords(user, { password: '', confirm: 'qwertyuiopasdfg' });
    expect(mocks.requestPasswordChangeCode).not.toHaveBeenCalled();
    expect(screen.getByLabelText('New password', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  });

  it("refuses the owner's name — the context-word rule", async () => {
    const user = userEvent.setup();
    await renderOpen(user);
    await user.type(screen.getByLabelText('New password', { exact: true }), 'gallage sunset lamp river');
    // The METER's own line — the hint under the fields says the same words,
    // so a page-wide text query would pass with the rule broken.
    const meter = () => document.getElementById('settings-password-strength');
    await waitFor(() => expect(meter()).toHaveTextContent(/Strength: Weak\..*your name, your email address/));
  });
});

describe('SettingsPasswordCard — step two', () => {
  async function toCodeStep(user) {
    await renderOpen(user);
    await fillPasswords(user);
    await screen.findByLabelText('6-digit code');
  }

  it('sends only the code, then empties the form, folds and flashes', async () => {
    const user = userEvent.setup();
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    await toCodeStep(user);
    await user.type(screen.getByLabelText('6-digit code'), '123456');
    await user.click(button('SAVE NEW PASSWORD'));

    // Only the code: step one's checks passed and the server holds the hash.
    expect(mocks.changePassword).toHaveBeenCalledWith({ code: '123456' });
    await waitFor(() => expect(mocks.showFlash).toHaveBeenCalledWith(
      'Password changed. Every other device was signed out.',
    ));
    expect(screen.getByLabelText('Current password')).toHaveValue('');
    expect(button('SEND CODE')).toBeDisabled();
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');   // folds again
    // Focus was on the submit button, now inside the inert fold — it must
    // land on the toggle, not be lost to <body>.
    await waitFor(() => expect(toggle()).toHaveFocus());
    // PF-133: "Last changed", the leak banner and the history re-read.
    expect(invalidate.mock.calls.map(([f]) => f.queryKey))
      .toEqual([['auth', 'me'], ['auth', 'sign-ins']]);
  });

  it('refuses a code that is not 6 digits — no request', async () => {
    const user = userEvent.setup();
    await toCodeStep(user);
    await user.type(screen.getByLabelText('6-digit code'), '12a');
    await user.click(button('SAVE NEW PASSWORD'));
    expect(mocks.changePassword).not.toHaveBeenCalled();
    expect(screen.getByLabelText('6-digit code')).toHaveAttribute('aria-invalid', 'true');
  });

  it('a wrong code shows the server message and keeps the code step', async () => {
    mocks.changePassword.mockRejectedValueOnce(
      serverError(400, 'That code is wrong or has expired. Check it, or request a new one.'),
    );
    const user = userEvent.setup();
    await toCodeStep(user);
    await user.type(screen.getByLabelText('6-digit code'), '000000');
    await user.click(button('SAVE NEW PASSWORD'));
    expect(await screen.findByText(/That code is wrong or has expired/)).toBeInTheDocument();
    expect(screen.getByLabelText('6-digit code')).toBeInTheDocument();
    expect(mocks.showFlash).not.toHaveBeenCalled();
  });

  it('RESEND waits out the cooldown', async () => {
    const user = userEvent.setup();
    await toCodeStep(user);
    expect(screen.getByRole('button', { name: /RESEND CODE IN \d+s/ })).toBeDisabled();
  });

  it('CANCEL goes back to the passwords, keeping them', async () => {
    const user = userEvent.setup();
    await toCodeStep(user);
    await user.click(button('CANCEL'));
    expect(screen.getByLabelText('Current password')).toHaveValue(CURRENT);
    expect(screen.getByLabelText('New password')).toHaveValue(NEW);
    expect(screen.queryByLabelText('6-digit code')).toBeNull();
  });
});

describe('SettingsPasswordCard — leaving with a half-typed change asks first', () => {
  it('asks Keep / Discard only — there is no save to offer', async () => {
    const user = userEvent.setup();
    const { router } = await renderOpen(user);
    await user.type(screen.getByLabelText('Current password'), 'x');
    await act(() => router.navigate('/elsewhere'));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('The password form has changes');
    const names = within(dialog).getAllByRole('button').map((b) => b.textContent);
    expect(names.some((n) => /SAVE/i.test(n))).toBe(false);
  });

  it('an untouched card lets you leave without asking', async () => {
    const { router } = renderCard();
    await act(() => router.navigate('/elsewhere'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(router.state.location.pathname).toBe('/elsewhere');
  });
});

describe('Last changed (PF-133)', () => {
  it('shows when the password last changed — visible while folded', () => {
    mocks.me = { ...mocks.me, passwordChangedAt: '2026-10-27T11:33:00.000Z' };
    renderCard();
    expect(screen.getByText('LAST CHANGED 27 OCT 2026')).toBeVisible();
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
  });

  it('says nothing for a password set before it was recorded', () => {
    renderCard();
    expect(screen.queryByText(/LAST CHANGED/)).toBeNull();
  });
});
