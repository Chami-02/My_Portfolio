// frontend/src/components/common/__tests__/ProtectedRoute.test.jsx
//
// PF-108 — the first test this component has had. It used to check that a
// string existed in localStorage; now it asks the server through useMe and
// has four states, each pinned here.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const useMe = vi.hoisted(() => vi.fn());
vi.mock('../../../hooks/useMe', () => ({ useMe }));

const { ProtectedRoute } = await import('../ProtectedRoute');

// The login page stand-in prints what ProtectedRoute handed it, so the
// test can see `state.from` rather than just "we ended up at /admin/login".
function LoginProbe() {
  const location = useLocation();
  const from = location.state?.from;
  return (
    <p data-testid="login">
      login · from={from ? `${from.pathname}${from.search}` : 'none'}
    </p>
  );
}

function renderAt(path = '/admin/projects?tab=2') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/login" element={<LoginProbe />} />
        <Route
          path="/admin/*"
          element={(
            <ProtectedRoute>
              <p>the panel</p>
            </ProtectedRoute>
          )}
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProtectedRoute', () => {
  it('while /auth/me is pending, shows a gate and mounts NOTHING underneath', () => {
    useMe.mockReturnValue({ data: undefined, isPending: true, isError: false });
    renderAt();

    expect(screen.getByRole('status', { name: /checking your session/i })).toBeInTheDocument();
    expect(screen.queryByText('the panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('login')).not.toBeInTheDocument();
  });

  it('renders the children once the account resolves', () => {
    useMe.mockReturnValue({ data: { email: 'owner@example.com' }, isPending: false, isError: false });
    renderAt();

    expect(screen.getByText('the panel')).toBeInTheDocument();
  });

  it('on a 401, redirects to /admin/login and remembers where the user was going', () => {
    useMe.mockReturnValue({
      data: undefined, isPending: false, isError: true,
      error: { response: { status: 401 } },
    });
    renderAt('/admin/projects?tab=2');

    expect(screen.getByTestId('login')).toHaveTextContent('from=/admin/projects?tab=2');
    expect(screen.queryByText('the panel')).not.toBeInTheDocument();
  });

  it('treats data === null (a failed silent refresh) as signed out, with no error', () => {
    // api.js writes null into the cache when a refresh fails. There is no
    // error object in this state — the query "succeeded" with null — so
    // the redirect must key on the data, not on isError.
    useMe.mockReturnValue({ data: null, isPending: false, isError: false });
    renderAt('/admin/blog');

    expect(screen.getByTestId('login')).toHaveTextContent('from=/admin/blog');
  });

  it('on a NON-401 error, shows a retry panel instead of bouncing to login', async () => {
    // Network down is not "signed out". With a refresh token still stored,
    // a redirect would have login send the user straight back here, and
    // the two would trade a failing request until the network returned.
    const refetch = vi.fn();
    useMe.mockReturnValue({
      data: undefined, isPending: false, isError: true,
      error: { message: 'Network Error' }, refetch,
    });
    renderAt();

    expect(screen.getByRole('alert')).toHaveTextContent(/couldn.t check your session/i);
    expect(screen.queryByTestId('login')).not.toBeInTheDocument();
    expect(screen.queryByText('the panel')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'RETRY' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('a 500 is also "retry", not "sign in"', () => {
    useMe.mockReturnValue({
      data: undefined, isPending: false, isError: true,
      error: { response: { status: 500 } }, refetch: vi.fn(),
    });
    renderAt();

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByTestId('login')).not.toBeInTheDocument();
  });
});
