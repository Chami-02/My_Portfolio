// frontend/src/pages/__tests__/AdminForgotPasswordPage.test.jsx
//
// PF-125 — /admin/forgot-password. `authService` is mocked at the service
// boundary; the real `resetErrorMessage` runs, because which sentence the
// reader sees is the thing under test.
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThemeProvider } from '../../providers/ThemeProvider';
import { MotionProvider } from '../../providers/MotionProvider';

const { requestPasswordReset, resetPassword } = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  resetPassword:        vi.fn(),
}));
vi.mock('../../services/authService', () => ({
  authService: { requestPasswordReset, resetPassword },
}));

const { AdminForgotPasswordPage } = await import('../AdminForgotPasswordPage');

const GOOD = 'a long new pass phrase';

function LoginLanding() {
  const { state } = useLocation();
  return <p data-testid="login">{JSON.stringify(state)}</p>;
}

function renderAt(entry = '/admin/forgot-password') {
  return render(
    <ThemeProvider>
      <MotionProvider>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/admin/forgot-password" element={<AdminForgotPasswordPage />} />
            <Route path="/admin/login"           element={<LoginLanding />} />
          </Routes>
        </MemoryRouter>
      </MotionProvider>
    </ThemeProvider>,
  );
}

const toCodeStep = async (user, email = 'me@example.com') => {
  await user.type(screen.getByLabelText('Email address'), email);
  await user.click(screen.getByRole('button', { name: 'SEND CODE →' }));
  await screen.findByLabelText('6-digit code');
};

const fillReset = async (user, { code = '123456', password = GOOD, confirm = password } = {}) => {
  if (code) await user.type(screen.getByLabelText('6-digit code'), code);
  if (password) await user.type(screen.getByLabelText(/^New password/), password);
  if (confirm) await user.type(screen.getByLabelText('Repeat new password'), confirm);
  await user.click(screen.getByRole('button', { name: 'RESET PASSWORD →' }));
};

beforeEach(() => {
  vi.clearAllMocks();
  requestPasswordReset.mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

describe('AdminForgotPasswordPage — step 1, the address', () => {
  it('names the page in a real heading', () => {
    renderAt();
    expect(screen.getByRole('heading', { level: 1, name: 'Reset password' })).toBeInTheDocument();
  });

  it('prefills the address the sign-in page carried over', () => {
    renderAt({ pathname: '/admin/forgot-password', state: { email: 'me@example.com' } });
    expect(screen.getByLabelText('Email address')).toHaveValue('me@example.com');
  });

  it('an empty address is refused here, with no request', async () => {
    const user = userEvent.setup();
    renderAt();
    await user.click(screen.getByRole('button', { name: 'SEND CODE →' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the email address you sign in with.');
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it('sends the address and READS IT BACK, so a typo shows', async () => {
    const user = userEvent.setup();
    renderAt();
    await toCodeStep(user, ' me@gmial.com ');
    expect(requestPasswordReset).toHaveBeenCalledWith('me@gmial.com');
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('If me@gmial.com can sign in here, a reset code is on its way. It expires in 10 minutes.');
    // Emphasised, so the address is the thing the eye lands on.
    expect(status.querySelector('strong')).toHaveTextContent('me@gmial.com');
  });

  it('an unreachable server is said as such, and the page stays on step 1', async () => {
    requestPasswordReset.mockRejectedValueOnce(new Error('Network Error'));
    const user = userEvent.setup();
    renderAt();
    await user.type(screen.getByLabelText('Email address'), 'me@example.com');
    await user.click(screen.getByRole('button', { name: 'SEND CODE →' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot reach the server/i);
    expect(screen.queryByLabelText('6-digit code')).toBeNull();
  });
});

describe('AdminForgotPasswordPage — step 2, the code and the new password', () => {
  // PF-124 follow-up — the strength meter and its refusal (the server checks too).
  it('shows the live strength, and refuses a weak password with no request', async () => {
    const user = userEvent.setup();
    renderAt();
    await toCodeStep(user);
    await user.type(screen.getByLabelText(/^New password/), 'qwertyuiopasdfg');
    expect(await screen.findByText(/Strength: Weak\./)).toBeInTheDocument();
    await fillReset(user, { password: '', confirm: 'qwertyuiopasdfg' });
    expect(screen.getByRole('alert')).toHaveTextContent(/commonly used password|easy to guess/);
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("refuses a password built from the typed address's name", async () => {
    const user = userEvent.setup();
    renderAt();
    await toCodeStep(user, 'sunsetrider@example.com');
    await user.type(screen.getByLabelText(/^New password/), 'sunsetrider lamp hill road');
    // The METER's own line, so the assertion is about the rule, not any text on the page.
    await waitFor(() => expect(document.getElementById('reset-strength'))
      .toHaveTextContent(/Strength: Weak\..*your name, your email address/));
  });

  it('the code field is built for a one-time code', async () => {
    const user = userEvent.setup();
    renderAt();
    await toCodeStep(user);
    const code = screen.getByLabelText('6-digit code');
    expect(code).toHaveAttribute('autocomplete', 'one-time-code');
    expect(code).toHaveAttribute('inputmode', 'numeric');
    expect(screen.getByLabelText(/^New password/)).toHaveAttribute('autocomplete', 'new-password');
  });

  it.each([
    ['a 5-digit code',         { code: '12345' },                        'Enter the 6-digit code from the email.'],
    ['a 14-character password', { password: 'fourteen-chars' },          'The new password must be at least 15 characters.'],
    ['two different entries',   { confirm: `${GOOD}!` },                 "The two passwords don't match."],
  ])('refuses %s here, with no request', async (_name, values, message) => {
    const user = userEvent.setup();
    renderAt();
    await toCodeStep(user);
    await fillReset(user, values);
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('a good reset goes to sign-in with "password changed" and the address', async () => {
    resetPassword.mockResolvedValueOnce('Password changed. Sign in with your new password.');
    const user = userEvent.setup();
    renderAt();
    await toCodeStep(user);
    await fillReset(user);
    expect(resetPassword).toHaveBeenCalledWith({ email: 'me@example.com', code: '123456', password: GOOD });
    expect(JSON.parse((await screen.findByTestId('login')).textContent))
      .toEqual({ passwordReset: true, email: 'me@example.com' });
  });

  it('shows the server\'s refusal (a wrong code) and stays', async () => {
    const message = 'That code is wrong or has expired. Check it, or request a new one.';
    resetPassword.mockRejectedValueOnce({ response: { status: 400, data: { message } } });
    const user = userEvent.setup();
    renderAt();
    await toCodeStep(user);
    await fillReset(user);
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('button', { name: 'RESET PASSWORD →' })).toBeEnabled();
  });

  it('one eye shows BOTH new-password fields', async () => {
    const user = userEvent.setup();
    renderAt();
    await toCodeStep(user);
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText(/^New password/)).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Repeat new password')).toHaveAttribute('type', 'text');
  });

  it('`Use a different address` goes back to step 1', async () => {
    const user = userEvent.setup();
    renderAt();
    await toCodeStep(user);
    await user.click(screen.getByRole('button', { name: 'Use a different address' }));
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('`Resend code` waits 60 seconds, then sends again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderAt();
    await toCodeStep(user);

    const resend = screen.getByRole('button', { name: /^Resend code in \d+s$/ });
    expect(resend).toBeDisabled();

    await act(async () => { vi.advanceTimersByTime(61_000); });
    const ready = screen.getByRole('button', { name: 'Resend code' });
    expect(ready).toBeEnabled();
    await user.click(ready);
    expect(requestPasswordReset).toHaveBeenCalledTimes(2);
  });
});
