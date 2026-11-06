// frontend/src/components/admin/panels/__tests__/SettingsSeasonalCard.test.jsx
//
// PF-151 — the switch. The service is mocked (the network is the edge); the
// hooks and TanStack Query are real, so "SAVE refetches" goes through the real path.
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import postcss from 'postcss';

const mocks = vi.hoisted(() => ({
  get: vi.fn(), update: vi.fn(), showFlash: vi.fn(), register: vi.fn(),
}));
vi.mock('../../../../services/aboutService', () => ({
  aboutService: { get: mocks.get, update: mocks.update },
}));
vi.mock('../../../../hooks/useAdminFlash', () => ({
  useAdminFlash: () => ({ showFlash: mocks.showFlash }),
}));
vi.mock('../../../../hooks/useUnsavedChanges', () => ({
  useUnsavedChanges: (entry) => { mocks.register(entry); return (proceed) => proceed(); },
}));

const { SettingsSeasonalCard } = await import('../SettingsSeasonalCard');

const renderCard = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <SettingsSeasonalCard />
  </QueryClientProvider>,
);
const card = () => screen.getByRole('region', { name: 'Seasonal effects' });
const radio = (name) => within(card()).getByRole('radio', { name, hidden: true });
const saveBtn = () => within(card()).getByRole('button', { name: 'SAVE', hidden: true });
const open = (user) => user.click(within(card()).getByRole('button', { name: 'CHANGE' }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 6, 12));
  mocks.get.mockResolvedValue({ name: 'Owner', location: 'Galle', seasonalEffect: 'auto' });
  mocks.update.mockResolvedValue({ seasonalEffect: 'snow' });
});
afterEach(() => vi.useRealTimers());

describe('SettingsSeasonalCard', () => {
  it('says what visitors see while folded', async () => {
    renderCard();
    expect(await screen.findByText('Automatic. Nothing is showing today. Snow starts on 1 December.')).toBeTruthy();
    expect(within(card()).getByRole('button', { name: 'CHANGE' }).getAttribute('aria-expanded')).toBe('false');
  });

  it('an old record with no field reads as AUTOMATIC', async () => {
    mocks.get.mockResolvedValue({});
    renderCard();
    await screen.findByText(/^Automatic\./);
    expect(radio('AUTOMATIC').checked).toBe(true);
  });

  it('offers the four choices, with the saved one picked', async () => {
    mocks.get.mockResolvedValue({ seasonalEffect: 'off' });
    renderCard();
    await screen.findByText(/^Off\./);
    expect(within(card()).getAllByRole('radio', { hidden: true }).map((r) => r.value))
      .toEqual(['auto', 'snow', 'halloween', 'off']);
    expect(radio('OFF').checked).toBe(true);
  });

  it('stages: picking a choice saves nothing, SAVE lights up, the status stays', async () => {
    const user = userEvent.setup();
    renderCard();
    await screen.findByText(/^Automatic\./);
    await open(user);
    expect(saveBtn().disabled).toBe(true);

    await user.click(radio('SNOW NOW'));

    expect(mocks.update).not.toHaveBeenCalled();
    expect(saveBtn().disabled).toBe(false);
    expect(within(card()).getByText('UNSAVED CHANGES')).toBeTruthy();
    expect(within(card()).getByText(/^Automatic\./)).toBeTruthy();
    expect(mocks.register.mock.lastCall[0].dirty).toBe(true);
  });

  it('picking the saved choice again is not a change', async () => {
    const user = userEvent.setup();
    renderCard();
    await screen.findByText(/^Automatic\./);
    await open(user);
    await user.click(radio('SNOW NOW'));
    await user.click(radio('AUTOMATIC'));
    expect(saveBtn().disabled).toBe(true);
    expect(mocks.register.mock.lastCall[0].dirty).toBe(false);
  });

  it('REVERT restores the saved choice, never an empty one', async () => {
    const user = userEvent.setup();
    mocks.get.mockResolvedValue({ seasonalEffect: 'halloween' });
    renderCard();
    await screen.findByText(/^Leaves and bats/);
    await open(user);
    await user.click(radio('OFF'));
    await user.click(within(card()).getByRole('button', { name: 'REVERT CHANGES' }));
    expect(radio('HALLOWEEN NOW').checked).toBe(true);
    expect(saveBtn().disabled).toBe(true);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('SAVE sends this one field and nothing else, then shows the new state', async () => {
    const user = userEvent.setup();
    renderCard();
    await screen.findByText(/^Automatic\./);
    await open(user);
    await user.click(radio('SNOW NOW'));

    mocks.get.mockResolvedValue({ seasonalEffect: 'snow' });
    await user.click(saveBtn());

    await waitFor(() => expect(mocks.showFlash).toHaveBeenCalledWith('Seasonal effects saved'));
    expect(mocks.update.mock.calls[0][0]).toEqual({ seasonalEffect: 'snow' });
    expect(within(card()).getByText('Snow is showing to every visitor, whatever the date.')).toBeTruthy();
    expect(saveBtn().disabled).toBe(true);
    expect(mocks.register.mock.lastCall[0].dirty).toBe(false);
  });

  it('a manual choice reminds the owner to set it back; AUTOMATIC does not', async () => {
    const REMINDER = /Set this back to AUTOMATIC/;
    const first = renderCard();
    await screen.findByText(/^Automatic\./);
    expect(screen.queryByText(REMINDER)).toBeNull();
    first.unmount();

    mocks.get.mockResolvedValue({ seasonalEffect: 'snow' });
    renderCard();
    expect(await screen.findByText(REMINDER)).toBeTruthy();
  });

  it('the leave dialog offers no Save: its Save must never publish', async () => {
    const user = userEvent.setup();
    renderCard();
    await screen.findByText(/^Automatic\./);
    await open(user);
    await user.click(radio('SNOW NOW'));
    expect(mocks.register.mock.lastCall[0].save).toBeUndefined();
  });

  it('folding with a staged choice discards it', async () => {
    const user = userEvent.setup();
    renderCard();
    await screen.findByText(/^Automatic\./);
    await open(user);
    await user.click(radio('SNOW NOW'));
    await user.click(within(card()).getByRole('button', { name: 'CHANGE' }));
    expect(radio('AUTOMATIC').checked).toBe(true);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('a failed save stays staged and says so in plain words', async () => {
    const user = userEvent.setup();
    mocks.update.mockRejectedValue(new Error('Network Error'));
    renderCard();
    await screen.findByText(/^Automatic\./);
    await open(user);
    await user.click(radio('SNOW NOW'));
    await user.click(saveBtn());

    expect(await within(card()).findByRole('alert', { hidden: true })).toBeTruthy();
    expect(radio('SNOW NOW').checked).toBe(true);
    expect(mocks.showFlash).not.toHaveBeenCalled();
  });

  // Owner: the glow was clipped to a square orange corner by the fold.
  it('SAVE carries the class that removes the glow, and the rule does remove it', async () => {
    renderCard();
    await screen.findByText(/^Automatic\./);
    expect(saveBtn().className).toMatch(/noGlow/);

    const sheet = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../AdminSettingsPanel.module.css'), 'utf8',
    );
    const rules = [];
    postcss.parse(sheet).walkRules(/noGlow/, (r) => rules.push(r));
    expect(rules).toHaveLength(1);
    expect(rules[0].selectors).toEqual(['.actions .noGlow', '.actions .noGlow:hover:not(:disabled)']);
    expect(rules[0].nodes.map((d) => `${d.prop}:${d.value}`)).toEqual(['box-shadow:none']);
  });

  it('a failed load shows LoadError, not a form with a guessed choice', async () => {
    mocks.get.mockRejectedValue(new Error('down'));
    renderCard();
    expect(await within(card()).findByRole('button', { name: /RETRY/ })).toBeTruthy();
    expect(within(card()).queryAllByRole('radio', { hidden: true })).toEqual([]);
  });
});
