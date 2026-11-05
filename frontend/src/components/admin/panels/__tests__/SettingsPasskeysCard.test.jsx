// frontend/src/components/admin/panels/__tests__/SettingsPasskeysCard.test.jsx
//
// PF-140 — the Settings Passkeys card. The service is mocked (the device and the
// network are the edges); the hooks, TanStack Query, the guard and ConfirmDialog
// are real, so "the list refetches after a change" goes through the real path.
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  list:       vi.fn(),
  prepareAdd: vi.fn(),
  finishAdd:  vi.fn(),
  remove:     vi.fn(),
  supported:  vi.fn(),
  showFlash:  vi.fn(),
}));
vi.mock('../../../../services/passkeyService', () => ({
  passkeySupported: mocks.supported,
  passkeyService: {
    list: mocks.list, prepareAdd: mocks.prepareAdd, finishAdd: mocks.finishAdd, remove: mocks.remove,
  },
}));
vi.mock('../../../../hooks/useAdminFlash', () => ({
  useAdminFlash: () => ({ showFlash: mocks.showFlash }),
}));

const { SettingsPasskeysCard } = await import('../SettingsPasskeysCard');

const MAC = Object.freeze({
  id: 'p1', label: 'Chrome on macOS', synced: true,
  addedAt: '2026-11-01T08:00:00.000Z', lastUsedAt: '2026-11-04T08:00:00.000Z',
});
const KEY = Object.freeze({
  id: 'p2', label: null, synced: false, addedAt: '2026-11-02T08:00:00.000Z', lastUsedAt: null,
});
const OPTIONS = Object.freeze({ challenge: 'abc' });

const axiosError = (status, message) =>
  Object.assign(new Error('x'), { isAxiosError: true, response: { status, data: { message } } });
const deviceError = (name) => Object.assign(new Error('x'), { name });

const renderCard = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <SettingsPasskeysCard />
  </QueryClientProvider>,
);

const card = () => screen.getByRole('region', { name: 'Passkeys' });
const dialog = () => screen.getByRole('dialog');

const unfold = async (user) => {
  await user.click(within(card()).getByRole('button', { name: /MANAGE PASSKEYS/ }));
};
const startAdd = async (user) => {
  await unfold(user);
  await user.click(await within(card()).findByRole('button', { name: '+ ADD A PASSKEY' }));
};
const toCreateStep = async (user) => {
  await startAdd(user);
  await user.type(within(dialog()).getByLabelText('Your password'), 'secret');
  await user.click(within(dialog()).getByRole('button', { name: 'CONTINUE' }));
  await within(dialog()).findByRole('button', { name: 'CREATE PASSKEY' });
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.supported.mockReturnValue(true);
  mocks.list.mockResolvedValue([MAC, KEY]);
});

describe('the list', () => {
  it('is folded at first, and says how many once loaded', async () => {
    renderCard();
    expect(await within(card()).findByText('2 ON THIS ACCOUNT')).toBeInTheDocument();
    expect(within(card()).getByRole('button', { name: /MANAGE PASSKEYS/ })).toHaveAttribute('aria-expanded', 'false');
  });

  it('says none yet with no passkeys', async () => {
    mocks.list.mockResolvedValue([]);
    renderCard();
    expect(await within(card()).findByText('NONE YET')).toBeInTheDocument();
  });

  it('shows no count while loading', () => {
    mocks.list.mockReturnValue(new Promise(() => {}));
    renderCard();
    expect(within(card()).queryByText(/ON THIS ACCOUNT|NONE YET/)).toBeNull();
  });

  it('shows each one\'s device, dates and whether it syncs', async () => {
    const user = userEvent.setup();
    renderCard();
    await unfold(user);
    const [mac, key] = await within(card()).findAllByRole('listitem');

    expect(within(mac).getByText('Chrome on macOS')).toBeInTheDocument();
    expect(within(mac).getByText('SYNCED')).toBeInTheDocument();
    expect(mac).toHaveTextContent('LAST USED');

    expect(within(key).getByText('Unnamed passkey')).toBeInTheDocument();
    expect(within(key).queryByText('SYNCED')).toBeNull();
    expect(key).toHaveTextContent('NOT USED YET');
  });

  it('a failed load shows LoadError, never the empty state or the ADD button', async () => {
    mocks.list.mockRejectedValue(axiosError(500, 'x'));
    const user = userEvent.setup();
    renderCard();
    await unfold(user);
    expect(await within(card()).findByRole('button', { name: /RETRY/ })).toBeInTheDocument();
    expect(within(card()).queryByText('NONE YET')).toBeNull();
    expect(within(card()).queryByRole('button', { name: '+ ADD A PASSKEY' })).toBeNull();
  });

  it('a browser without passkeys is told so, and gets no ADD button', async () => {
    mocks.supported.mockReturnValue(false);
    const user = userEvent.setup();
    renderCard();
    await unfold(user);
    expect(await within(card()).findByText(/This browser can't make passkeys/)).toBeInTheDocument();
    expect(within(card()).queryByRole('button', { name: '+ ADD A PASSKEY' })).toBeNull();
  });
});

describe('adding one', () => {
  it('an empty password is marked, and nothing is sent', async () => {
    const user = userEvent.setup();
    renderCard();
    await startAdd(user);
    await user.click(within(dialog()).getByRole('button', { name: 'CONTINUE' }));
    expect(within(dialog()).getByText('Enter your password.')).toBeInTheDocument();
    expect(mocks.prepareAdd).not.toHaveBeenCalled();
  });

  it('a wrong password stays on the dialog with the server\'s sentence', async () => {
    mocks.prepareAdd.mockRejectedValue(axiosError(400, 'Your password is wrong.'));
    const user = userEvent.setup();
    renderCard();
    await startAdd(user);
    await user.type(within(dialog()).getByLabelText('Your password'), 'nope');
    await user.click(within(dialog()).getByRole('button', { name: 'CONTINUE' }));
    expect(await within(dialog()).findByText('Your password is wrong.')).toBeInTheDocument();
    expect(mocks.finishAdd).not.toHaveBeenCalled();
  });

  it('the device is only asked after its OWN press, not after the password', async () => {
    mocks.prepareAdd.mockResolvedValue(OPTIONS);
    const user = userEvent.setup();
    renderCard();
    await toCreateStep(user);
    expect(mocks.prepareAdd.mock.calls[0][0]).toEqual({ password: 'secret' });
    expect(mocks.finishAdd).not.toHaveBeenCalled();
  });

  it('finishes, says so, refetches the list and closes', async () => {
    mocks.prepareAdd.mockResolvedValue(OPTIONS);
    mocks.finishAdd.mockResolvedValue({ id: 'p3', label: 'Safari on macOS' });
    const user = userEvent.setup();
    renderCard();
    await toCreateStep(user);
    const before = mocks.list.mock.calls.length;
    await user.click(within(dialog()).getByRole('button', { name: 'CREATE PASSKEY' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(mocks.finishAdd.mock.calls[0][0]).toEqual(OPTIONS);
    expect(mocks.showFlash).toHaveBeenCalledWith('Passkey added: Safari on macOS');
    await waitFor(() => expect(mocks.list.mock.calls.length).toBeGreaterThan(before));
  });

  it('closing the device\'s prompt keeps the step, so it can be pressed again', async () => {
    mocks.prepareAdd.mockResolvedValue(OPTIONS);
    mocks.finishAdd.mockRejectedValueOnce(deviceError('NotAllowedError')).mockResolvedValueOnce({ label: 'x' });
    const user = userEvent.setup();
    renderCard();
    await toCreateStep(user);
    await user.click(within(dialog()).getByRole('button', { name: 'CREATE PASSKEY' }));
    expect(await within(dialog()).findByText(/was cancelled/)).toBeInTheDocument();

    await user.click(within(dialog()).getByRole('button', { name: 'CREATE PASSKEY' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(mocks.prepareAdd).toHaveBeenCalledTimes(1);
  });

  it('a device that already holds one says so', async () => {
    mocks.prepareAdd.mockResolvedValue(OPTIONS);
    mocks.finishAdd.mockRejectedValue(deviceError('InvalidStateError'));
    const user = userEvent.setup();
    renderCard();
    await toCreateStep(user);
    await user.click(within(dialog()).getByRole('button', { name: 'CREATE PASSKEY' }));
    expect(await within(dialog()).findByText('This device already has a passkey for your account.')).toBeInTheDocument();
  });

  it('a refusal from the server goes back to the password: that challenge is spent', async () => {
    mocks.prepareAdd.mockResolvedValue(OPTIONS);
    mocks.finishAdd.mockRejectedValue(axiosError(400, "We couldn't add that passkey. Please try again."));
    const user = userEvent.setup();
    renderCard();
    await toCreateStep(user);
    await user.click(within(dialog()).getByRole('button', { name: 'CREATE PASSKEY' }));

    expect(await within(dialog()).findByLabelText('Your password')).toBeInTheDocument();
    expect(within(dialog()).getByText("We couldn't add that passkey. Please try again.")).toBeInTheDocument();
  });
});

describe('removing one', () => {
  const startRemove = async (user) => {
    await unfold(user);
    const [mac] = await within(card()).findAllByRole('listitem');
    await user.click(within(mac).getByRole('button', { name: 'REMOVE' }));
  };

  it('needs the password, and focus starts in that field', async () => {
    const user = userEvent.setup();
    renderCard();
    await startRemove(user);
    expect(within(dialog()).getByLabelText('Your password')).toHaveFocus();
    await user.click(within(dialog()).getByRole('button', { name: 'REMOVE' }));
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it('sends the id and password, says so, and refetches', async () => {
    mocks.remove.mockResolvedValue();
    const user = userEvent.setup();
    renderCard();
    await startRemove(user);
    const before = mocks.list.mock.calls.length;
    await user.type(within(dialog()).getByLabelText('Your password'), 'secret');
    await user.click(within(dialog()).getByRole('button', { name: 'REMOVE' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(mocks.remove.mock.calls[0][0]).toEqual({ id: 'p1', password: 'secret' });
    expect(mocks.showFlash).toHaveBeenCalledWith('Passkey removed: Chrome on macOS');
    await waitFor(() => expect(mocks.list.mock.calls.length).toBeGreaterThan(before));
  });

  it('a wrong password stays open with the server\'s sentence', async () => {
    mocks.remove.mockRejectedValue(axiosError(400, 'Your password is wrong.'));
    const user = userEvent.setup();
    renderCard();
    await startRemove(user);
    await user.type(within(dialog()).getByLabelText('Your password'), 'nope');
    await user.click(within(dialog()).getByRole('button', { name: 'REMOVE' }));
    expect(await within(dialog()).findByText('Your password is wrong.')).toBeInTheDocument();
  });

  it('CANCEL sends nothing', async () => {
    const user = userEvent.setup();
    renderCard();
    await startRemove(user);
    await user.click(within(dialog()).getByRole('button', { name: 'CANCEL' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
