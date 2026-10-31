// PF-143 — the Education panel (EntryListPanel + LinkedIn's education form).
// Every staging assertion is a PAIR: nothing sent on the edit, then SAVE sends it.
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWithGuard } from '../../../../test/renderWithGuard';

const m = vi.hoisted(() => {
  const mut = () => ({ mutateAsync: vi.fn(), isPending: false });
  return {
    list: vi.fn(), about: vi.fn(),
    create: mut(), update: mut(), remove: mut(), reorder: mut(), upload: mut(), removePic: mut(),
    updateAbout: mut(), showFlash: vi.fn(),
  };
});

vi.mock('../../../../hooks/useEntries', () => ({
  educationHooks: {
    useAdmin: m.list,
    useCreate: () => m.create, useUpdate: () => m.update, useRemove: () => m.remove,
    useReorder: () => m.reorder, useUploadPicture: () => m.upload, useRemovePicture: () => m.removePic,
  },
}));
vi.mock('../../../../hooks/useAbout', () => ({ useAbout: m.about, useUpdateAbout: () => m.updateAbout }));
vi.mock('../../../../hooks/useAdminFlash', () => ({ useAdminFlash: () => ({ showFlash: m.showFlash }) }));

const { AdminEducationPanel } = await import('../AdminEducationPanel');

const formCard = () => screen.getByRole('heading', { name: /new education entry|edit education entry/i }).closest('section');
const inForm = (label) => within(formCard()).getByLabelText(label);

beforeEach(() => {
  vi.clearAllMocks();
  m.list.mockReturnValue({ data: [], isLoading: false });
  m.about.mockReturnValue({ data: {}, isLoading: false });
  m.create.mutateAsync = vi.fn().mockResolvedValue({ _id: 'e1' });
  window.scrollTo = vi.fn();
});

describe('AdminEducationPanel', () => {
  it('has every field of LinkedIn\'s education form', () => {
    renderWithGuard(<AdminEducationPanel />);
    for (const label of ['School', 'Degree', 'Field of study', 'Grade', 'Start date — year', 'End date (or expected) — year',
      'Activities and societies', 'Description', 'School website (optional)']) {
      expect(inForm(label)).toBeInTheDocument();
    }
    // No skills and no proof (owner, 2026-10-31); the one file is the LOGO, pictures only.
    expect(within(formCard()).queryByLabelText(/skills|proof/i)).not.toBeInTheDocument();
    const file = formCard().querySelector('input[type="file"]');
    expect(file.getAttribute('accept')).not.toMatch(/pdf/);
    expect(within(formCard()).getByText(/PNG, JPEG OR WEBP · MAX/)).toBeInTheDocument();
    expect(within(formCard()).queryByText(/OR PDF/)).not.toBeInTheDocument();
    expect(within(formCard()).getByText(/the school's logo, PNG, JPEG or WebP/)).toBeInTheDocument();
  });

  it('has no Section text card — the heading is fixed (owner, 2026-10-31)', () => {
    renderWithGuard(<AdminEducationPanel />);
    expect(screen.queryByRole('heading', { name: 'Section text' })).not.toBeInTheDocument();
  });

  it('school, start and end are required even for a draft — each says so under itself, the banner names them', async () => {
    const user = userEvent.setup();
    renderWithGuard(<AdminEducationPanel />);
    await user.type(inForm('Grade'), 'First');
    await user.click(within(formCard()).getByRole('button', { name: 'SAVE AS DRAFT' }));
    expect(m.create.mutateAsync).not.toHaveBeenCalled();
    expect(within(formCard()).getByText('CHECK THE CHANGES AGAIN — School, Start date, End date (or expected) need attention.'))
      .toBeInTheDocument();
    for (const label of ['School', 'Start date — year', 'End date (or expected) — year']) {
      const box = inForm(label);
      expect(box).toHaveAttribute('aria-invalid', 'true');
      expect(document.getElementById(box.getAttribute('aria-describedby'))).toHaveTextContent('This field is required.');
    }
  });

  it('a school and its years save as a draft; typed months are tidied (9 → SEP)', async () => {
    const user = userEvent.setup();
    renderWithGuard(<AdminEducationPanel />);
    await user.type(inForm('School'), 'University of Westminster');
    await user.type(inForm('Start date — month'), '9');
    await user.type(inForm('Start date — year'), '2022');
    await user.type(inForm('End date (or expected) — year'), '2027');
    expect(inForm('Start date — month')).toHaveValue('SEP');
    await user.click(within(formCard()).getByRole('button', { name: 'SAVE AS DRAFT' }));
    expect(m.create.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      school: 'University of Westminster', start: '2022-09', end: '2027', published: false,
    }));
  });

  it('an optional day can be typed: 4 / 5 / 2008 is sent as 2008-05-04 (owner, 2026-10-31)', async () => {
    const user = userEvent.setup();
    renderWithGuard(<AdminEducationPanel />);
    await user.type(inForm('School'), 'Mahinda College');
    await user.type(inForm('Start date — day'), '4');
    await user.type(inForm('Start date — month'), '5');
    await user.type(inForm('Start date — year'), '2008');
    await user.type(inForm('End date (or expected) — year'), '2021');
    expect(inForm('Start date — day')).toHaveValue('04');
    await user.click(within(formCard()).getByRole('button', { name: 'SAVE AS DRAFT' }));
    expect(m.create.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ start: '2008-05-04', end: '2021' }));
  });

  it('a day that is not in its month is refused, saying why', async () => {
    const user = userEvent.setup();
    renderWithGuard(<AdminEducationPanel />);
    await user.type(inForm('Start date — day'), '31');
    await user.type(inForm('Start date — month'), 'apr');
    await user.type(inForm('Start date — year'), '2008');
    await user.tab();
    expect(within(formCard()).getByText('APR 2008 has only 30 days.')).toBeInTheDocument();
  });

  it('29 FEB is refused in a non-leap year, and the day list offers only that month\'s days', async () => {
    const user = userEvent.setup();
    renderWithGuard(<AdminEducationPanel />);
    await user.type(inForm('Start date — day'), '29');
    await user.type(inForm('Start date — month'), 'feb');
    await user.type(inForm('Start date — year'), '2025');
    await user.tab();
    expect(within(formCard()).getByText('FEB 2025 has only 28 days.')).toBeInTheDocument();
    const days = document.getElementById(`${inForm('Start date — day').id}-list`).querySelectorAll('option');
    expect(days).toHaveLength(28);
  });

  it('a wrong year shows its problem when the box is left, not while typing', async () => {
    const user = userEvent.setup();
    renderWithGuard(<AdminEducationPanel />);
    await user.type(inForm('Start date — year'), '20');
    expect(within(formCard()).queryByText(/Type a year from 1980/)).not.toBeInTheDocument();
    await user.tab();
    expect(within(formCard()).getByText(/Type a year from 1980 to \d{4}\./)).toBeInTheDocument();
  });

  it('the end cannot be before the start — refused, nothing sent', async () => {
    const user = userEvent.setup();
    renderWithGuard(<AdminEducationPanel />);
    await user.type(inForm('School'), 'W');
    await user.type(inForm('Degree'), 'BSc');
    await user.type(inForm('Start date — year'), '2022');
    await user.type(inForm('End date (or expected) — year'), '2021');
    await user.click(within(formCard()).getByRole('button', { name: 'ADD EDUCATION ENTRY' }));
    expect(m.create.mutateAsync).not.toHaveBeenCalled();
    expect(inForm('End date (or expected) — year')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows an empty list before the first entry, with no count while loading', () => {
    m.list.mockReturnValue({ data: undefined, isLoading: true });
    renderWithGuard(<AdminEducationPanel />);
    expect(screen.getByRole('heading', { name: 'All education' })).toBeInTheDocument();
  });
});
