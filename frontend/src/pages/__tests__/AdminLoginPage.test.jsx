// frontend/src/pages/__tests__/AdminLoginPage.test.jsx
//
// PF-109 — the first test /admin/login has had. Two halves:
//
//   1. BEHAVIOUR, rendered. The form, its labels, the two different
//      failure sentences, the busy label, the post-login destination and
//      the stored-token redirect. `authService.login` is mocked at the
//      service boundary; the real `session` store and the real
//      `loginErrorMessage` run, because the 401-vs-no-server distinction
//      is the thing under test and a mock of it would assert nothing.
//
//   2. STRUCTURE, parsed. CSS-Module rules are invisible to Vitest (no
//      stylesheet is ever applied, document.styleSheets is empty), so the
//      module is read as text and walked with postcss — never a raw
//      string search, because this module's header comment NAMES the
//      values being asserted (the prefixed pair, the carriers) and a
//      substring match would pass against the prose.
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postcss from 'postcss';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThemeProvider } from '../../providers/ThemeProvider';
import { MotionProvider } from '../../providers/MotionProvider';
import { session } from '../../services/session';

const login = vi.hoisted(() => vi.fn());
vi.mock('../../services/authService', () => ({ authService: { login } }));

const { AdminLoginPage } = await import('../AdminLoginPage');

/* Prints where the router ended up, search and hash included, so the
   test can see the WHOLE destination rather than just its pathname. */
function Landing() {
  const { pathname, search, hash } = useLocation();
  return <p data-testid="landing">{`${pathname}${search}${hash}`}</p>;
}

/* Theme and Motion are REQUIRED: ThemeToggle and StarfieldCanvas both
   throw outside their provider, by design. No QueryClientProvider — the
   page fetches nothing on render. */
function renderAt(entry = '/admin/login') {
  return render(
    <ThemeProvider>
      <MotionProvider>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin/*"     element={<Landing />} />
          </Routes>
        </MemoryRouter>
      </MotionProvider>
    </ThemeProvider>,
  );
}

const fillAndSubmit = async (user) => {
  await user.type(screen.getByLabelText('Email address'), 'me@example.com');
  await user.type(screen.getByLabelText('Password'), 'hunter2');
  await user.click(screen.getByRole('button', { name: 'SIGN IN →' }));
};

beforeEach(() => {
  vi.clearAllMocks();
  session.clear();
});
afterEach(() => session.clear());

describe('AdminLoginPage — behaviour (PF-109)', () => {

  it('names the page in a real heading', () => {
    renderAt();
    // getByRole, not getByText: the outlined word is a span inside the
    // h1 and the accessible name is what is under test.
    expect(screen.getByRole('heading', { level: 1, name: 'Admin sign in' })).toBeInTheDocument();
  });

  it('exposes both fields BY LABEL — the Phase 1 page could not', () => {
    // The old markup put a <label> with no htmlFor next to an <input>
    // with no id: visually labelled, not associated. getByLabelText is
    // the assertion that fails against that markup and passes against a
    // wrapping <label>.
    renderAt();
    const email = screen.getByLabelText('Email address');
    const pass  = screen.getByLabelText('Password');
    expect(email).toHaveAttribute('type', 'email');
    expect(email).toHaveAttribute('autocomplete', 'email');
    expect(pass).toHaveAttribute('type', 'password');
    expect(pass).toHaveAttribute('autocomplete', 'current-password');
    expect(email).toBeRequired();
    expect(pass).toBeRequired();
  });

  it('renders no error banner until there is an error', () => {
    renderAt();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('a 401 says the credentials are wrong', async () => {
    login.mockRejectedValueOnce({ response: { status: 401, data: { message: 'Invalid email or password' } } });
    const user = userEvent.setup();
    renderAt();
    await fillAndSubmit(user);
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password. Please try again.');
  });

  it('no response at all says the server is unreachable — a DIFFERENT sentence', async () => {
    // The whole reason utils/loginError.js exists: a single fallback
    // string once made a stopped backend read as a wrong password.
    login.mockRejectedValueOnce(new Error('Network Error'));
    const user = userEvent.setup();
    renderAt();
    await fillAndSubmit(user);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/cannot reach the server/i);
    expect(alert).not.toHaveTextContent(/invalid email or password/i);
  });

  it('shows SIGNING IN… while the request is in flight, then clears it on failure', async () => {
    let reject;
    login.mockImplementationOnce(() => new Promise((_, r) => { reject = r; }));
    const user = userEvent.setup();
    renderAt();
    await fillAndSubmit(user);

    const busy = screen.getByRole('button', { name: 'SIGNING IN…' });
    expect(busy).toBeDisabled();

    reject({ response: { status: 401 } });
    expect(await screen.findByRole('button', { name: 'SIGN IN →' })).toBeEnabled();
  });

  it('lands on /admin after a plain visit', async () => {
    login.mockResolvedValueOnce({});
    const user = userEvent.setup();
    renderAt();
    await fillAndSubmit(user);
    expect(await screen.findByTestId('landing')).toHaveTextContent('/admin');
    expect(login).toHaveBeenCalledWith('me@example.com', 'hunter2');
  });

  it('honours ProtectedRoute\'s state.from — pathname, search AND hash (PF-108)', async () => {
    login.mockResolvedValueOnce({});
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <MotionProvider>
          <MemoryRouter
            initialEntries={[{
              pathname: '/admin/login',
              state: { from: { pathname: '/admin/projects', search: '?tab=2', hash: '#p3' } },
            }]}
          >
            <Routes>
              <Route path="/admin/login" element={<AdminLoginPage />} />
              <Route path="/admin/*"     element={<Landing />} />
            </Routes>
          </MemoryRouter>
        </MotionProvider>
      </ThemeProvider>,
    );
    await fillAndSubmit(user);
    expect(await screen.findByTestId('landing')).toHaveTextContent('/admin/projects?tab=2#p3');
  });

  it('with a stored refresh token, redirects without rendering the form', async () => {
    session.set({ accessToken: 'a', refreshToken: 'r', refreshExpiresAt: Date.now() + 60_000 });
    renderAt();
    await waitFor(() => expect(screen.getByTestId('landing')).toHaveTextContent('/admin'));
    expect(screen.queryByLabelText('Email address')).toBeNull();
    expect(login).not.toHaveBeenCalled();
  });

  it('links back to the portfolio with the splash suppressed', () => {
    renderAt();
    expect(screen.getByRole('link', { name: '← BACK TO PORTFOLIO' })).toHaveAttribute('href', '/?nosplash=1');
  });

  it('carries the site\'s theme toggle, not a second one', () => {
    renderAt();
    // The default theme is dark, so the toggle's name points at light.
    expect(screen.getByRole('button', { name: /switch to light theme/i })).toBeInTheDocument();
  });

  it('marks the sheen decorative so reduced motion removes it rather than freezing it', () => {
    renderAt();
    const button = screen.getByRole('button', { name: 'SIGN IN →' });
    const sheen = button.querySelector('[data-motion-decorative]');
    expect(sheen).not.toBeNull();
    expect(sheen).toHaveAttribute('aria-hidden', 'true');
  });

  it('does not print the design preview credentials', () => {
    renderAt();
    // Admin.dc.html:100 prints the demo password. It is not transcribed:
    // CI's credential scan greps for it, and it is design-tool furniture.
    expect(document.body.textContent).not.toMatch(/DESIGN PREVIEW/);
    expect(document.body.textContent).not.toMatch(/Admin@/);
  });
});

/* ── The stylesheet, parsed ─────────────────────────────────────── */

const here = dirname(fileURLToPath(import.meta.url));
const css  = readFileSync(resolve(here, '../AdminLoginPage.module.css'), 'utf8');
const root = postcss.parse(css);

const decls = (selector) => {
  const out = {};
  root.walkRules(selector, (rule) => rule.walkDecls((d) => { out[d.prop] = d.value; }));
  return out;
};

describe('AdminLoginPage.module.css — structure (PF-109)', () => {

  it('parsed some rules', () => {
    // A guard over an empty parse reports "clean" in the same words as a
    // clean sheet.
    let n = 0;
    root.walkRules(() => { n += 1; });
    expect(n).toBeGreaterThan(20);
  });

  it('writes -webkit-backdrop-filter BEFORE backdrop-filter on the card', () => {
    // esbuild keeps only the LAST of a prefixed pair and Chrome ignores
    // the prefix — the other order ships a blur that never renders.
    const order = [];
    root.walkRules('.card', (rule) => rule.walkDecls((d) => {
      if (d.prop.endsWith('backdrop-filter')) order.push(d.prop);
    }));
    expect(order).toEqual(['-webkit-backdrop-filter', 'backdrop-filter']);
  });

  it.each([
    ['.card',    'kf-riseIn-admin from global'],
    ['.brand',   'kf-typeIn from global'],
    ['.logoWrap','kf-floatY from global'],
    ['.ring',    'kf-ringPulse from global'],
    ['.heading', 'kf-typeIn from global'],
    ['.lede',    'kf-typeIn from global'],
    ['.error',   'kf-fadeIn from global'],
    ['.rule',    'kf-barGrow from global'],
    ['.field',   'kf-typeIn from global'],
    ['.submit',  'kf-typeIn from global'],
    ['.sheen',   'kf-sheen-admin from global'],
    ['.foot',    'kf-typeIn from global'],
  ])('%s reaches its keyframe through the global carrier %s', (selector, carrier) => {
    // A keyframe NAMED inside a *.module.css is scoped to an identifier
    // no @keyframes defines; the element then silently never animates.
    const d = decls(selector);
    expect(d.composes).toBe(carrier);
    expect(d['animation-name']).toBeUndefined();
    // Longhands only: the `animation` shorthand resets animation-name to
    // `none` and undoes the composed class.
    expect(d.animation).toBeUndefined();
  });

  it('composes the site-wide outline-text pattern for the second word', () => {
    expect(decls('.headingOutline').composes).toBe("outline-text from '../styles/patterns.module.css'");
  });

  it('keeps the prototype\'s stagger — seven typeIn delays in order', () => {
    const delay = (sel) => parseFloat(decls(sel)['animation-delay']);
    expect(delay('.brand')).toBe(0.05);
    expect(delay('.heading')).toBe(0.14);
    expect(delay('.lede')).toBe(0.22);
    expect(delay('.fieldEmail')).toBe(0.34);
    expect(delay('.fieldPassword')).toBe(0.42);
    expect(delay('.submit')).toBe(0.5);
    expect(delay('.foot')).toBe(0.58);
  });

  it('suppresses no outline anywhere', () => {
    // The export writes `outline: none` on the inputs. This repo's only
    // sanctioned one is main[tabindex="-1"]:focus, and the login field
    // uses the transparent-outline idiom instead.
    const offenders = [];
    root.walkDecls('outline', (d) => { if (/^none\b/.test(d.value)) offenders.push(d.parent.selector); });
    expect(offenders).toEqual([]);
    expect(decls('.input:focus-visible').outline).toBe('2px solid transparent');
  });

  it('cancels the hover lift on a disabled submit', () => {
    // `:hover` still matches a disabled button; without the guard the
    // button rises under the cursor mid-sign-in.
    const selectors = [];
    root.walkRules((r) => { if (r.selector.includes('.submit:hover')) selectors.push(r.selector); });
    expect(selectors).toEqual(['.submit:hover:not(:disabled)']);
  });

  it('names no font family literally', () => {
    root.walkDecls('font-family', (d) => {
      expect(d.value, `${d.parent.selector}: ${d.value}`).toMatch(/^var\(--font-(mono|body|display)\)$/);
    });
  });
});
