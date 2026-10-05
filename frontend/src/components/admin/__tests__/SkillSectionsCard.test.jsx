// frontend/src/components/admin/__tests__/SkillSectionsCard.test.jsx
//
// PF-114 — the owner's Skills SECTIONS card. Behaviour, not pixels.
//
// ⚠️ Every staged action is a PAIR — "nothing sent yet" AND "SAVE sends it".
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const m = vi.hoisted(() => ({
  create:  { mutateAsync: vi.fn(), isPending: false },
  rename:  { mutateAsync: vi.fn(), isPending: false },
  reorder: { mutateAsync: vi.fn(), isPending: false },
  remove:  { mutateAsync: vi.fn(), isPending: false },
  showFlash: vi.fn(),
}));

vi.mock('../../../hooks/useSkillCategories', () => ({
  useCreateSkillCategory:    () => m.create,
  useRenameSkillCategory:    () => m.rename,
  useReorderSkillCategories: () => m.reorder,
  useDeleteSkillCategory:    () => m.remove,
}));
vi.mock('../../../hooks/useAdminFlash', () => ({
  useAdminFlash: () => ({ showFlash: m.showFlash }),
}));

const { SkillSectionsCard } = await import('../SkillSectionsCard');

// Already in display order — the panel sorts before handing them over.
const SECTIONS = Object.freeze([
  { _id: 'c1', key: 'language', label: 'Languages', order: 1 },
  { _id: 'c2', key: 'soft',     label: 'Soft Skills', order: 2 },
  { _id: 'c6', key: 'other',    label: 'Other',     order: 3 },
].map(Object.freeze));
const COUNTS = Object.freeze({ language: 5, soft: 2, other: 0 });

const renderCard = (categories = SECTIONS, counts = COUNTS) =>
  render(<SkillSectionsCard categories={categories} counts={counts} />);
const nameInput = (i) => screen.getByLabelText(`Name of section ${i}`);
const httpError = (status, message) => ({ response: { status, data: { message } } });

beforeEach(() => {
  vi.clearAllMocks();
  for (const x of [m.create, m.rename, m.reorder, m.remove]) x.mutateAsync.mockResolvedValue({});
});

describe('the list', () => {
  it('shows every section with its skill count, EMPTY for none', () => {
    renderCard();
    expect(screen.getByRole('heading', { name: 'Sections (3)' })).toBeInTheDocument();
    expect(nameInput(1)).toHaveValue('Languages');
    expect(screen.getByText('5 SKILLS')).toBeInTheDocument();
    expect(screen.getByText('2 SKILLS')).toBeInTheDocument();
    expect(screen.getByText('EMPTY')).toBeInTheDocument();
  });

  it('cannot delete the LAST section', () => {
    renderCard([SECTIONS[0]], { language: 5 });
    expect(screen.getByRole('button', { name: 'Delete section Languages' })).toBeDisabled();
  });
});

describe('adding', () => {
  it('creates at once — the add is its own save — and flashes', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.type(screen.getByLabelText('New section'), '  Cloud ');
    await user.click(screen.getByRole('button', { name: '+ ADD SECTION' }));
    expect(m.create.mutateAsync).toHaveBeenCalledWith('Cloud');
    await waitFor(() => expect(m.showFlash).toHaveBeenCalledWith('Section added'));
    expect(screen.getByLabelText('New section')).toHaveValue('');
  });

  it('refuses an existing name in any case — shake and mark, nothing sent', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.type(screen.getByLabelText('New section'), 'soft skills');
    await user.click(screen.getByRole('button', { name: '+ ADD SECTION' }));
    expect(m.create.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByLabelText('New section')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('"soft skills" is already a section.')).toBeInTheDocument();
  });
});

describe('rename and reorder are STAGED', () => {
  it('no SAVE bar until something changes', () => {
    renderCard();
    expect(screen.queryByRole('button', { name: 'SAVE SECTIONS' })).toBeNull();
  });

  it('a rename is sent only on SAVE SECTIONS', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.clear(nameInput(2));
    await user.type(nameInput(2), 'People Skills');
    expect(m.rename.mutateAsync).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'SAVE SECTIONS' }));
    expect(m.rename.mutateAsync).toHaveBeenCalledWith({ id: 'c2', label: 'People Skills' });
    expect(m.reorder.mutateAsync).not.toHaveBeenCalled();
    await waitFor(() => expect(m.showFlash).toHaveBeenCalledWith('Sections saved'));
  });

  it('▲ ▼ stage a new order, sent whole on SAVE', async () => {
    const user = userEvent.setup();
    renderCard();
    expect(screen.getByRole('button', { name: 'Move Languages up' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Move Other up' }));
    expect(nameInput(2)).toHaveValue('Other');
    expect(m.reorder.mutateAsync).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'SAVE SECTIONS' }));
    expect(m.reorder.mutateAsync).toHaveBeenCalledWith(['c1', 'c6', 'c2']);
  });

  it('REVERT restores names and order — never blanks', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole('button', { name: 'Move Other up' }));
    await user.clear(nameInput(1));
    await user.click(screen.getByRole('button', { name: 'REVERT CHANGES' }));
    expect(nameInput(1)).toHaveValue('Languages');
    expect(nameInput(3)).toHaveValue('Other');
  });

  it('a blank or duplicate name is refused and marked; nothing is sent', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.clear(nameInput(1));
    await user.clear(nameInput(3));
    await user.type(nameInput(3), 'soft skills');
    await user.click(screen.getByRole('button', { name: 'SAVE SECTIONS' }));

    expect(m.rename.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText(/2 fields need attention/)).toBeInTheDocument();
    expect(nameInput(1)).toHaveAttribute('aria-invalid', 'true');
    expect(nameInput(3)).toHaveAttribute('aria-invalid', 'true');
  });

  it('a server refusal goes to the banner', async () => {
    m.rename.mutateAsync.mockRejectedValue(httpError(409, 'A section named "X" already exists'));
    const user = userEvent.setup();
    renderCard();
    await user.type(nameInput(3), 's');
    await user.click(screen.getByRole('button', { name: 'SAVE SECTIONS' }));
    expect(await screen.findByText(/A section named "X" already exists/)).toBeInTheDocument();
    expect(m.showFlash).not.toHaveBeenCalled();
  });
});

// The owner's three choices (2026-10-05): CANCEL · MOVE & DELETE · DELETE
// SECTION + N SKILLS.
describe('deleting', () => {
  it('an EMPTY section asks plainly, focuses CANCEL, and deletes with no choice', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole('button', { name: 'Delete section Other' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('“Other” is empty');
    expect(within(dialog).getByRole('button', { name: 'CANCEL' })).toHaveFocus();
    expect(within(dialog).queryByRole('button', { name: /MOVE/ })).toBeNull();

    await user.click(within(dialog).getByRole('button', { name: 'YES, DELETE' }));
    expect(m.remove.mutateAsync).toHaveBeenCalledWith({ id: 'c6', choice: {} });
  });

  it('a section WITH skills offers all three, CANCEL focused, and CANCEL does nothing', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole('button', { name: 'Delete section Soft Skills' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('“Soft Skills” still has 2 skills');
    expect(within(dialog).getByRole('button', { name: 'CANCEL' })).toHaveFocus();
    expect(within(dialog).getByRole('button', { name: 'MOVE & DELETE' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'DELETE SECTION + 2 SKILLS' })).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'CANCEL' }));
    expect(m.remove.mutateAsync).not.toHaveBeenCalled();
  });

  it('MOVE & DELETE sends the chosen destination — defaulting to Other', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole('button', { name: 'Delete section Soft Skills' }));
    const dialog = screen.getByRole('dialog');
    const picker = within(dialog).getByLabelText('Move 2 skills to');
    expect(picker).toHaveValue('c6');
    // The section being deleted is never a destination.
    expect([...picker.options].map((o) => o.textContent)).toEqual(['Languages', 'Other']);

    await user.selectOptions(picker, 'c1');
    await user.click(within(dialog).getByRole('button', { name: 'MOVE & DELETE' }));
    expect(m.remove.mutateAsync).toHaveBeenCalledWith({ id: 'c2', choice: { moveTo: 'c1' } });
    await waitFor(() => expect(m.showFlash).toHaveBeenCalledWith('Skills moved, section deleted'));
  });

  it('DELETE SECTION + N SKILLS sends deleteSkills: true', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole('button', { name: 'Delete section Soft Skills' }));
    await user.click(screen.getByRole('button', { name: 'DELETE SECTION + 2 SKILLS' }));
    expect(m.remove.mutateAsync).toHaveBeenCalledWith({ id: 'c2', choice: { deleteSkills: true } });
    await waitFor(() => expect(m.showFlash).toHaveBeenCalledWith('Section and its skills deleted'));
  });

  // Only the choice that LOSES data wears the danger style.
  it('MOVE & DELETE is not red; DELETE SECTION + SKILLS is', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole('button', { name: 'Delete section Soft Skills' }));
    expect(screen.getByRole('button', { name: 'MOVE & DELETE' }).className).not.toMatch(/btnDanger/);
    expect(screen.getByRole('button', { name: 'DELETE SECTION + 2 SKILLS' }).className).toMatch(/btnDanger/);
  });

  it('a failed delete says so in the banner', async () => {
    m.remove.mutateAsync.mockRejectedValue({});
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole('button', { name: 'Delete section Other' }));
    await user.click(screen.getByRole('button', { name: 'YES, DELETE' }));
    expect(await screen.findByText(/Delete: the server could not be reached/)).toBeInTheDocument();
  });
});
