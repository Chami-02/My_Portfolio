// frontend/src/components/common/__tests__/ProtectedRoute.sessionGlitch.test.jsx
//
// PF-147 — a brief failure while renewing must not sign the admin out, and must
// not start the loop a careless fix causes: api.js passes on the old 401,
// ProtectedRoute reads "signed out" and goes to login, login sees a session that
// was kept and sends them back, and the two bounce until the network returns.
//
// That loop lives BETWEEN these modules, so everything here is real: the two
// pages, useMe, authService, api.js and its interceptors, the session store. Only
// the network is scripted, and ProtectedRoute.test.jsx covers its states alone.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import { AxiosError } from 'axios';
import { ThemeProvider } from '../../../providers/ThemeProvider';
import { MotionProvider } from '../../../providers/MotionProvider';
import api from '../../../services/api';
import { session } from '../../../services/session';
import { queryClient } from '../../../lib/queryClient';
import { ProtectedRoute } from '../ProtectedRoute';
import { AdminLoginPage } from '../../../pages/AdminLoginPage';

const answer = (config, status, data = {}) => ({ data, status, statusText: '', headers: {}, config });
const fail = (config, status) => new AxiosError(`status ${status}`, AxiosError.ERR_BAD_RESPONSE, config, null, answer(config, status));
const networkDown = (config) => new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);

let calls;
const script = (plan) => {
  calls = [];
  api.defaults.adapter = async (config) => {
    calls.push(config.url);
    return plan[config.url](config, calls.filter((u) => u === config.url).length);
  };
};
const count = (url) => calls.filter((u) => u === url).length;

const renderAdmin = () => render(
  <ThemeProvider>
    <MotionProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin" element={<ProtectedRoute><p data-testid="panel">the panel</p></ProtectedRoute>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </MotionProvider>
  </ThemeProvider>,
);

const SIGNED_IN = { accessToken: 'a', refreshExpiresAt: '2099-01-01T00:00:00.000Z' };
const RENEWED   = { accessToken: 'b', refreshExpiresAt: '2099-01-02T00:00:00.000Z' };

beforeEach(() => {
  localStorage.clear();
  session.clear();
  queryClient.clear();
});

describe('Reloading /admin while the renewal fails for a moment', () => {
  it.each([
    ['the network is down', networkDown],
    ['too many requests', (c) => fail(c, 429)],
    ['the server fails', (c) => fail(c, 500)],
  ])('%s: shows RETRY, not the login form, and does not loop', async (_name, failure) => {
    session.set(SIGNED_IN);
    script({
      '/auth/me':      (c) => { throw fail(c, 401); },
      '/auth/refresh': (c) => { throw failure(c); },
    });

    renderAdmin();

    expect(await screen.findByRole('button', { name: 'RETRY' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Email address')).toBeNull();
    expect(session.probablySignedIn()).toBe(true);

    // A loop would keep asking. One ask each, and it has settled.
    await new Promise((r) => { setTimeout(r, 50); });
    expect(count('/auth/me')).toBe(1);
    expect(count('/auth/refresh')).toBe(1);
  });

  it('RETRY recovers once the network is back, without signing in', async () => {
    const user = userEvent.setup();
    session.set(SIGNED_IN);
    script({
      '/auth/me': (c, n) => {
        if (n <= 2) throw fail(c, 401);
        return answer(c, 200, { data: { email: 'owner@example.com' } });
      },
      '/auth/refresh': (c, n) => {
        if (n === 1) throw networkDown(c);
        return answer(c, 200, RENEWED);
      },
    });

    renderAdmin();
    await user.click(await screen.findByRole('button', { name: 'RETRY' }));

    expect(await screen.findByTestId('panel')).toBeInTheDocument();
    expect(session.getAccessToken()).toBe('b');
  });
});

describe('The control: a session that really ended', () => {
  it('goes to the login form once, and stays there', async () => {
    session.set(SIGNED_IN);
    script({
      '/auth/me':      (c) => { throw fail(c, 401); },
      '/auth/refresh': (c) => { throw fail(c, 401); },
    });

    renderAdmin();

    expect(await screen.findByLabelText('Email address')).toBeInTheDocument();
    expect(session.probablySignedIn()).toBe(false);
    await new Promise((r) => { setTimeout(r, 50); });
    await waitFor(() => expect(count('/auth/refresh')).toBe(1));
  });

  it('a browser with no session at all also lands on the form', async () => {
    script({
      '/auth/me':      (c) => { throw fail(c, 401); },
      '/auth/refresh': (c) => { throw fail(c, 401); },
    });

    renderAdmin();

    expect(await screen.findByLabelText('Email address')).toBeInTheDocument();
  });
});
