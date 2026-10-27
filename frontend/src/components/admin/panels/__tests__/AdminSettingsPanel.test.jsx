// frontend/src/components/admin/panels/__tests__/AdminSettingsPanel.test.jsx
//
// PF-131 — the Settings panel's Account card. It reads the shell's /auth/me
// entry and nothing else, so the hook is mocked (same pattern as
// AdminLayout.test.jsx: Vite's SSR transform makes exports getter-only, which
// vi.spyOn cannot redefine).
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const useMe = vi.hoisted(() => vi.fn());
vi.mock('../../../../hooks/useMe', () => ({ useMe }));
// PF-124 follow-up: the Password card reads the About name for its strength words.
vi.mock('../../../../hooks/useAbout', () => ({ useAbout: () => ({ data: { name: 'Parindra Gallage' } }) }));

const { AdminSettingsPanel } = await import('../AdminSettingsPanel');

const PRIMARY = 'pcgallege@gmail.com';
const SECOND  = 'parindrachameekara@gmail.com';

// signedInAs is the SECOND address, so a card that printed `email` where it
// should print `signedInAs` fails.
const ME = Object.freeze({
  email: PRIMARY,
  signedInAs: SECOND,
  signedInWith: 'google',
  role: 'admin',
  addresses: Object.freeze([
    Object.freeze({ address: PRIMARY, primary: true,  google: false }),
    Object.freeze({ address: SECOND,  primary: false, google: true  }),
  ]),
});

const card = () => screen.getByRole('region', { name: 'Account' });
const fact = (term) => screen.getByText(term, { selector: 'dt' }).nextElementSibling;
const rows = () => within(fact('Login addresses')).getAllByRole('listitem');

beforeEach(() => {
  vi.clearAllMocks();
  useMe.mockReturnValue({ data: ME });
});

describe('AdminSettingsPanel — Account card', () => {
  it('renders only the BUILT cards — Account, then Password — no placeholders', () => {
    render(<AdminSettingsPanel />);
    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-labelledby')))
      .toEqual(['settings-account-title', 'settings-password-title']);
    expect(card()).toBeInTheDocument();
    expect(screen.queryByText(/coming soon/i)).toBeNull();
  });

  it('names the address THIS login used, not the primary', () => {
    render(<AdminSettingsPanel />);
    expect(fact('Signed in as')).toHaveTextContent(SECOND);
    expect(fact('Signed in as')).not.toHaveTextContent(PRIMARY);
  });

  // PF-131 (owner, 2026-10-27): HOW this login signed in.
  it.each([
    ['google',   'Google'],
    ['password', 'Password'],
  ])('names the method THIS login used (%s)', (method, label) => {
    useMe.mockReturnValue({ data: { ...ME, signedInWith: method } });
    render(<AdminSettingsPanel />);
    expect(fact('Signed in with')).toHaveTextContent(new RegExp(`^${label}$`));
  });

  it.each([null, undefined, 'passkey'])(
    'shows no method line when the session recorded none it knows (%s)', (method) => {
      useMe.mockReturnValue({ data: { ...ME, signedInWith: method } });
      render(<AdminSettingsPanel />);
      expect(screen.queryByText('Signed in with')).toBeNull();
      expect(fact('Signed in as')).toHaveTextContent(SECOND);
    });

  it('lists every login address, primary first and tagged PRIMARY', () => {
    render(<AdminSettingsPanel />);
    const [first, second] = rows();
    expect(rows()).toHaveLength(2);
    expect(first).toHaveTextContent(PRIMARY);
    expect(within(first).getByText('PRIMARY')).toBeInTheDocument();
    expect(second).toHaveTextContent(SECOND);
    expect(within(second).queryByText('PRIMARY')).toBeNull();
  });

  it('tags GOOGLE LINKED only on the address Google is bound to', () => {
    render(<AdminSettingsPanel />);
    const [first, second] = rows();
    expect(within(first).queryByText('GOOGLE LINKED')).toBeNull();
    expect(within(second).getByText('GOOGLE LINKED')).toBeInTheDocument();
  });

  it('lists Google as a sign-in method once an address is linked', () => {
    render(<AdminSettingsPanel />);
    expect(fact('Sign-in methods')).toHaveTextContent(/^Password · Google$/);
  });

  it('lists Password alone while no address has used Google', () => {
    useMe.mockReturnValue({
      data: { ...ME, addresses: ME.addresses.map((x) => ({ ...x, google: false })) },
    });
    render(<AdminSettingsPanel />);
    expect(fact('Sign-in methods')).toHaveTextContent(/^Password$/);
    expect(screen.queryByText('GOOGLE LINKED')).toBeNull();
  });

  it('shows nothing address-shaped until /auth/me answers', () => {
    useMe.mockReturnValue({ data: undefined, isLoading: true });
    render(<AdminSettingsPanel />);
    expect(card()).toBeInTheDocument();
    expect(card()).not.toHaveTextContent('@');
    expect(screen.queryByText('Signed in as')).toBeNull();
  });

  it('falls back to the primary alone for a backend that sends no addresses', () => {
    useMe.mockReturnValue({ data: { email: PRIMARY, signedInAs: PRIMARY, role: 'admin' } });
    render(<AdminSettingsPanel />);
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent(PRIMARY);
    expect(fact('Sign-in methods')).toHaveTextContent(/^Password$/);
  });
});
