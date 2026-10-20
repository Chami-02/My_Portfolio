// frontend/src/components/common/__tests__/ProtectedRoute.test.jsx
//
// PF-108 — the first test this component has had. It used to check that a
// string existed in localStorage; now it asks the server through useMe and
// has four states, each pinned here. PF-130 made the pending state the
// branded LoadingScreen and put a Suspense (same screen) around the children.
import { lazy } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThemeProvider } from '../../../providers/ThemeProvider';
import { MotionProvider } from '../../../providers/MotionProvider';
import { LOADING_DELAY_MS } from '../LoadingScreen';

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

// Theme + Motion: the loading screen mounts the site's ambient layer.
const tree = (path, panel) => (
  <ThemeProvider>
    <MotionProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/login" element={<LoginProbe />} />
          <Route
            path="/admin/*"
            element={(
              <ProtectedRoute>
                {panel}
              </ProtectedRoute>
            )}
          />
        </Routes>
      </MemoryRouter>
    </MotionProvider>
  </ThemeProvider>
);

function renderAt(path = '/admin/projects?tab=2', panel = <p>the panel</p>) {
  return render(tree(path, panel));
}

/** A lazy panel whose chunk "arrives" when the test says so. */
function lazyPanel() {
  let arrive;
  const chunk = new Promise((r) => { arrive = () => r({ default: () => <p>the panel</p> }); });
  const Panel = lazy(() => chunk);
  return { panel: <Panel />, arrive: () => act(async () => { arrive(); await chunk; }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => { vi.useRealTimers(); });

describe('ProtectedRoute', () => {
  it('while /auth/me is pending, shows the loading screen and mounts NOTHING underneath', () => {
    vi.useFakeTimers();
    useMe.mockReturnValue({ data: undefined, isPending: true, isError: false });
    renderAt();

    // A quick check paints nothing (PF-130's delay)…
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    // …a slow one says what is happening.
    act(() => { vi.advanceTimersByTime(LOADING_DELAY_MS); });
    expect(screen.getByRole('status')).toHaveTextContent('Signing you in…');
    expect(screen.queryByText('the panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('login')).not.toBeInTheDocument();
  });

  it('a lazy panel whose chunk is still downloading shows the SAME screen, then the panel', async () => {
    // PF-130. Before, <AdminPage/>'s chunk suspended to App's blank
    // fallback — a blank frame between "signing you in" and the shell.
    vi.useFakeTimers();
    useMe.mockReturnValue({ data: { email: 'owner@example.com' }, isPending: false, isError: false });
    const { panel, arrive } = lazyPanel();
    renderAt('/admin', panel);

    act(() => { vi.advanceTimersByTime(LOADING_DELAY_MS); });
    expect(screen.getByRole('status')).toHaveTextContent('Signing you in…');

    await arrive();
    expect(screen.getByText('the panel')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('a slow session check hands over to the chunk wait with no blank in between', () => {
    vi.useFakeTimers();
    useMe.mockReturnValue({ data: undefined, isPending: true, isError: false });
    const { panel } = lazyPanel();
    const { rerender } = renderAt('/admin', panel);
    act(() => { vi.advanceTimersByTime(LOADING_DELAY_MS); });
    expect(screen.getByRole('status')).toHaveTextContent('Signing you in…');

    // /auth/me answers; the panel's chunk has not arrived. The very next
    // frame must still show the screen — not restart the 300 ms delay.
    useMe.mockReturnValue({ data: { email: 'owner@example.com' }, isPending: false, isError: false });
    rerender(tree('/admin', panel));
    expect(screen.getByRole('status')).toHaveTextContent('Signing you in…');
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
