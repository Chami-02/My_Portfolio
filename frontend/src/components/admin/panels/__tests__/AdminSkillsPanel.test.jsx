// frontend/src/components/admin/panels/__tests__/AdminSkillsPanel.test.jsx
//
// PF-114 — the rebuilt Skills panel. Behaviour, not pixels. The panel had no
// test at all before this ticket.
//
// ⚠️ Every staging assertion is a PAIR — "nothing was sent yet" AND "SAVE then
// sends it" — because the first half alone passes against a panel that never
// sends anything (the AdminProjectsPanel.test.jsx discipline).
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// Mocked at the MODULE level: Vite's SSR transform makes exports getter-only.
const hooks = vi.hoisted(() => ({
  useSkills: vi.fn(),
  create:  { mutateAsync: vi.fn(), isPending: false },
  update:  { mutateAsync: vi.fn(), isPending: false },
  reorder: { mutateAsync: vi.fn(), isPending: false },
  remove:  { mutateAsync: vi.fn(), isPending: false },
  showFlash: vi.fn(),
}));

vi.mock('../../../../hooks/useSkills', () => ({
  useSkills:        hooks.useSkills,
  useCreateSkill:   () => hooks.create,
  useUpdateSkill:   () => hooks.update,
  useReorderSkills: () => hooks.reorder,
  useDeleteSkill:   () => hooks.remove,
}));

// PF-114 — sections. The panel reads the list; SkillSectionsCard (rendered
// inside it, covered by its own test file) needs the mutations to exist.
const sections = vi.hoisted(() => ({ useSkillCategories: vi.fn(), m: { mutateAsync: vi.fn(), isPending: false } }));
vi.mock('../../../../hooks/useSkillCategories', () => ({
  useSkillCategories:        sections.useSkillCategories,
  useCreateSkillCategory:    () => sections.m,
  useRenameSkillCategory:    () => sections.m,
  useReorderSkillCategories: () => sections.m,
  useDeleteSkillCategory:    () => sections.m,
}));

vi.mock('../../../../hooks/useAdminFlash', () => ({
  useAdminFlash: () => ({ showFlash: hooks.showFlash }),
}));

const { AdminSkillsPanel } = await import('../AdminSkillsPanel');

// Shuffled against `order`, and frozen — a panel that sorted the cached array
// in place would throw here.
const SKILLS = Object.freeze([
  Object.freeze({ _id: 's3', name: 'Next.js', category: 'frontend', level: 'beginner',     order: 10 }),
  Object.freeze({ _id: 's1', name: 'React',   category: 'frontend', level: 'intermediate', order: 6 }),
  Object.freeze({ _id: 's2', name: 'Vite',    category: 'frontend', level: 'intermediate', order: 7 }),
  Object.freeze({ _id: 's9', name: 'Docker',  category: 'devops',   level: 'intermediate', order: 21 }),
]);

// Shuffled against `order`, like the skills.
const SECTIONS = Object.freeze([
  { _id: 'c9', key: 'devops',   label: 'DevOps',    order: 5 },
  { _id: 'c1', key: 'language', label: 'Languages', order: 1 },
  { _id: 'c2', key: 'frontend', label: 'Frontend',  order: 2 },
  { _id: 'c6', key: 'other',    label: 'Other',     order: 6 },
].map(Object.freeze));

const formCard = () => screen.getByRole('heading', { name: /new skill|edit skill/i }).closest('section');
const listCard = () => screen.getByRole('heading', { name: /all skills/i }).closest('section');
const field = (label) => within(formCard()).getByLabelText(label);
const btn = (name) => within(formCard()).getByRole('button', { name });
const queryBtn = (name) => within(formCard()).queryByRole('button', { name });
const chipNames = (category) => {
  const group = within(listCard()).getByRole('heading', { name: category }).parentElement;
  return within(group).getAllByRole('button', { name: /^Edit / })
    .map((b) => b.getAttribute('aria-label').replace('Edit ', ''));
};
const httpError = (status, message) => ({ response: { status, data: { message } } });

beforeEach(() => {
  vi.clearAllMocks();
  hooks.useSkills.mockReturnValue({ data: SKILLS, isLoading: false });
  sections.useSkillCategories.mockReturnValue({ data: SECTIONS, isLoading: false });
  hooks.create.mutateAsync.mockResolvedValue({ _id: 'new' });
  hooks.update.mutateAsync.mockResolvedValue({});
  hooks.reorder.mutateAsync.mockResolvedValue([]);
  hooks.remove.mutateAsync.mockResolvedValue({});
  window.scrollTo = vi.fn();
});

describe('the list', () => {
  it('counts every skill and groups chips by category, each card in order', () => {
    render(<AdminSkillsPanel />);
    expect(screen.getByRole('heading', { name: 'All skills (4)' })).toBeInTheDocument();
    expect(chipNames('Frontend')).toEqual(['React', 'Vite', 'Next.js']);
    expect(chipNames('DevOps')).toEqual(['Docker']);
  });

  it('shows each chip\'s level', () => {
    render(<AdminSkillsPanel />);
    expect(screen.getByRole('button', { name: 'Edit Next.js' })).toHaveTextContent('Next.js· beginner');
  });

  // PF-114 — with sections, "no skills" is every box saying it is empty
  // (each is still a drop target and a destination for ADD).
  it('says so when there are no skills — every section box explains it is empty', () => {
    hooks.useSkills.mockReturnValue({ data: [], isLoading: false });
    render(<AdminSkillsPanel />);
    expect(screen.getAllByText(/Empty — not shown on the home page\./)).toHaveLength(SECTIONS.length);
  });
});

describe('adding', () => {
  it('ADD SKILL is dim until a name is typed', async () => {
    const user = userEvent.setup();
    render(<AdminSkillsPanel />);
    expect(btn('+ ADD SKILL')).toBeDisabled();
    await user.type(field('Skill name'), 'Rust');
    expect(btn('+ ADD SKILL')).toBeEnabled();
  });

  it('sends a trimmed payload, flashes, and KEEPS category and level for the next one', async () => {
    const user = userEvent.setup();
    render(<AdminSkillsPanel />);
    await user.type(field('Skill name'), '  Rust ');
    await user.selectOptions(field('Category'), 'language');
    await user.selectOptions(field('Level'), 'advanced');
    await user.click(btn('+ ADD SKILL'));

    expect(hooks.create.mutateAsync).toHaveBeenCalledWith({ name: 'Rust', category: 'language', level: 'advanced' });
    await waitFor(() => expect(hooks.showFlash).toHaveBeenCalledWith('Skill added'));
    // Admin.dc.html:949 — the name clears, the card and level stay.
    expect(field('Skill name')).toHaveValue('');
    expect(field('Category')).toHaveValue('language');
    expect(field('Level')).toHaveValue('advanced');
  });

  it('refuses a blank name with a shake and a mark — and sends NOTHING', async () => {
    const user = userEvent.setup();
    render(<AdminSkillsPanel />);
    await user.type(field('Skill name'), '   ');
    await user.click(btn('+ ADD SKILL'));

    expect(hooks.create.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText(/CHECK THE CHANGES AGAIN — 1 field needs attention/)).toBeInTheDocument();
    expect(field('Skill name')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Skill name is required.')).toBeInTheDocument();
    expect(btn('+ ADD SKILL').className).toMatch(/shake/);
  });

  it('refuses a duplicate name before the server has to', async () => {
    const user = userEvent.setup();
    render(<AdminSkillsPanel />);
    await user.type(field('Skill name'), 'React');
    await user.click(btn('+ ADD SKILL'));
    expect(hooks.create.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText('A skill named "React" already exists.')).toBeInTheDocument();
  });

  it('clears the mark on the next keystroke', async () => {
    const user = userEvent.setup();
    render(<AdminSkillsPanel />);
    await user.type(field('Skill name'), ' ');
    await user.click(btn('+ ADD SKILL'));
    await user.type(field('Skill name'), 'R');
    expect(field('Skill name')).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('puts a server refusal in a banner, not under a field', async () => {
    hooks.create.mutateAsync.mockRejectedValue(httpError(409, 'A skill named "Rust" already exists'));
    const user = userEvent.setup();
    render(<AdminSkillsPanel />);
    await user.type(field('Skill name'), 'Rust');
    await user.click(btn('+ ADD SKILL'));

    expect(await screen.findByText('Skill: A skill named "Rust" already exists')).toBeInTheDocument();
    expect(field('Skill name')).not.toHaveAttribute('aria-invalid', 'true');
    expect(hooks.showFlash).not.toHaveBeenCalled();
  });

  // PF-114 — the dropdown is the owner's sections, by label, in order.
  it('offers the sections, by name, in section order', () => {
    render(<AdminSkillsPanel />);
    expect([...field('Category').options].map((o) => o.textContent))
      .toEqual(['Languages', 'Frontend', 'DevOps', 'Other']);
    expect(field('Category')).toHaveValue('frontend');
  });

  it('can add a skill straight into an owner-created section', async () => {
    sections.useSkillCategories.mockReturnValue({
      data: [...SECTIONS, { _id: 'cs', key: 'soft-skills', label: 'Soft Skills', order: 7 }], isLoading: false,
    });
    const user = userEvent.setup();
    render(<AdminSkillsPanel />);
    await user.type(field('Skill name'), 'Teamwork');
    await user.selectOptions(field('Category'), 'soft-skills');
    await user.click(btn('+ ADD SKILL'));
    expect(hooks.create.mutateAsync)
      .toHaveBeenCalledWith({ name: 'Teamwork', category: 'soft-skills', level: 'beginner' });
  });

  it('shows an EMPTY section as a box saying it is hidden on the home page', () => {
    render(<AdminSkillsPanel />);
    const group = within(listCard()).getByRole('heading', { name: 'Other' }).parentElement;
    expect(group).toHaveTextContent('Empty — not shown on the home page.');
  });
});

describe('editing', () => {
  const openReact = async (user) => {
    await user.click(screen.getByRole('button', { name: 'Edit React' }));
  };

  it('a chip opens the skill in the top card, marked active', async () => {
    const user = userEvent.setup();
    render(<AdminSkillsPanel />);
    await openReact(user);

    expect(screen.getByRole('heading', { name: 'Edit skill' })).toBeInTheDocument();
    expect(field('Skill name')).toHaveValue('React');
    expect(field('Level')).toHaveValue('intermediate');
    expect(screen.getByRole('button', { name: 'Edit React' })).toHaveAttribute('aria-pressed', 'true');
    expect(queryBtn('+ ADD SKILL')).toBeNull();
  });

  it('SAVE CHANGES is dim until something changes; REVERT appears only while dirty', async () => {
    const user = userEvent.setup();
    render(<AdminSkillsPanel />);
    await openReact(user);
    expect(btn('SAVE CHANGES')).toBeDisabled();
    expect(queryBtn('REVERT CHANGES')).toBeNull();

    await user.selectOptions(field('Level'), 'advanced');
    expect(btn('SAVE CHANGES')).toBeEnabled();
    expect(btn('REVERT CHANGES')).toBeInTheDocument();
  });

  // The owner's case (2026-10-05): "when i grow my skill level it should be
  // shown as the advanced or intermediate."
  it('re-grading a level sends it on SAVE, and only then', async () => {
    const user = userEvent.setup();
    render(<AdminSkillsPanel />);
    await openReact(user);
    await user.selectOptions(field('Level'), 'advanced');
    expect(hooks.update.mutateAsync).not.toHaveBeenCalled();

    await user.click(btn('SAVE CHANGES'));
    expect(hooks.update.mutateAsync).toHaveBeenCalledWith({
      id: 's1', data: { name: 'React', category: 'frontend', level: 'advanced' },
    });
    await waitFor(() => expect(hooks.showFlash).toHaveBeenCalledWith('Skill updated'));
    expect(screen.getByRole('heading', { name: 'Add new skill' })).toBeInTheDocument();
    expect(hooks.reorder.mutateAsync).not.toHaveBeenCalled();
  });

  it('REVERT restores the SAVED skill — never a blank form', async () => {
    const user = userEvent.setup();
    render(<AdminSkillsPanel />);
    await openReact(user);
    await user.clear(field('Skill name'));
    await user.type(field('Skill name'), 'Reakt');
    await user.click(btn('REVERT CHANGES'));

    expect(field('Skill name')).toHaveValue('React');
    expect(screen.getByRole('heading', { name: 'Edit skill' })).toBeInTheDocument();
    expect(btn('SAVE CHANGES')).toBeDisabled();
  });

  it('keeping its own name is not a duplicate', async () => {
    const user = userEvent.setup();
    render(<AdminSkillsPanel />);
    await openReact(user);
    await user.selectOptions(field('Level'), 'beginner');
    await user.click(btn('SAVE CHANGES'));
    expect(hooks.update.mutateAsync).toHaveBeenCalled();
  });

  it('CANCEL EDIT leaves edit mode and sends nothing', async () => {
    const user = userEvent.setup();
    render(<AdminSkillsPanel />);
    await openReact(user);
    await user.selectOptions(field('Level'), 'advanced');
    await user.click(btn('CANCEL EDIT'));

    expect(screen.getByRole('heading', { name: 'Add new skill' })).toBeInTheDocument();
    expect(hooks.update.mutateAsync).not.toHaveBeenCalled();
  });
});

describe('moving within a card', () => {
  const openVite = async (user) => {
    await user.click(screen.getByRole('button', { name: 'Edit Vite' }));
  };

  it('shows the position and disables an arrow at either end', async () => {
    const user = userEvent.setup();
    render(<AdminSkillsPanel />);
    await user.click(screen.getByRole('button', { name: 'Edit React' }));
    expect(screen.getByText('1 of 3 in FRONTEND')).toBeInTheDocument();
    expect(btn('Move React earlier')).toBeDisabled();
    expect(btn('Move React later')).toBeEnabled();
  });

  it('STAGES the move — the list shows it, nothing is sent — then SAVE sends the whole card', async () => {
    const user = userEvent.setup();
    render(<AdminSkillsPanel />);
    await openVite(user);
    await user.click(btn('Move Vite earlier'));

    expect(chipNames('Frontend')).toEqual(['Vite', 'React', 'Next.js']);
    expect(screen.getByText('1 of 3 in FRONTEND')).toBeInTheDocument();
    expect(hooks.reorder.mutateAsync).not.toHaveBeenCalled();
    expect(btn('SAVE CHANGES')).toBeEnabled();

    await user.click(btn('SAVE CHANGES'));
    expect(hooks.reorder.mutateAsync).toHaveBeenCalledWith(['s2', 's1', 's3']);
    // Fields untouched → no field PUT.
    expect(hooks.update.mutateAsync).not.toHaveBeenCalled();
    await waitFor(() => expect(hooks.showFlash).toHaveBeenCalledWith('Skill updated'));
  });

  it('REVERT puts a staged move back', async () => {
    const user = userEvent.setup();
    render(<AdminSkillsPanel />);
    await openVite(user);
    await user.click(btn('Move Vite later'));
    await user.click(btn('REVERT CHANGES'));
    expect(chipNames('Frontend')).toEqual(['React', 'Vite', 'Next.js']);
    expect(btn('SAVE CHANGES')).toBeDisabled();
  });

  it('fields go first, then the order', async () => {
    const calls = [];
    hooks.update.mutateAsync.mockImplementation(async () => { calls.push('update'); });
    hooks.reorder.mutateAsync.mockImplementation(async () => { calls.push('reorder'); });
    const user = userEvent.setup();
    render(<AdminSkillsPanel />);
    await openVite(user);
    await user.selectOptions(field('Level'), 'advanced');
    await user.click(btn('Move Vite later'));
    await user.click(btn('SAVE CHANGES'));
    await waitFor(() => expect(calls).toEqual(['update', 'reorder']));
  });

  it('a category change drops the arrows — the skill goes to the end of its new section', async () => {
    const user = userEvent.setup();
    render(<AdminSkillsPanel />);
    await openVite(user);
    await user.click(btn('Move Vite earlier'));
    await user.selectOptions(field('Category'), 'devops');

    expect(queryBtn('Move Vite earlier')).toBeNull();
    expect(screen.getByText('Moves to the end of DEVOPS on save.')).toBeInTheDocument();
    await user.click(btn('SAVE CHANGES'));
    expect(hooks.update.mutateAsync).toHaveBeenCalled();
    expect(hooks.reorder.mutateAsync).not.toHaveBeenCalled();
  });

  it('a failed reorder keeps the move staged and never flashes success', async () => {
    hooks.reorder.mutateAsync.mockRejectedValue(httpError(400, 'Send every skill in the category, in the new order'));
    const user = userEvent.setup();
    render(<AdminSkillsPanel />);
    await openVite(user);
    await user.click(btn('Move Vite later'));
    await user.click(btn('SAVE CHANGES'));

    expect(await screen.findByText(/Position: Send every skill/)).toBeInTheDocument();
    expect(hooks.showFlash).not.toHaveBeenCalled();
    expect(chipNames('Frontend')).toEqual(['React', 'Next.js', 'Vite']);
  });
});

describe('deleting', () => {
  it('× asks first, focuses CANCEL, and CANCEL deletes nothing', async () => {
    const user = userEvent.setup();
    render(<AdminSkillsPanel />);
    await user.click(screen.getByRole('button', { name: 'Delete Docker' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('“Docker”');
    expect(within(dialog).getByRole('button', { name: /cancel/i })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: /cancel/i }));
    expect(hooks.remove.mutateAsync).not.toHaveBeenCalled();
  });

  it('confirming deletes that skill and flashes', async () => {
    const user = userEvent.setup();
    render(<AdminSkillsPanel />);
    await user.click(screen.getByRole('button', { name: 'Delete Docker' }));
    await user.click(screen.getByRole('button', { name: 'YES, DELETE' }));
    expect(hooks.remove.mutateAsync).toHaveBeenCalledWith('s9');
    await waitFor(() => expect(hooks.showFlash).toHaveBeenCalledWith('Skill deleted'));
  });

  it('deleting the skill being edited leaves edit mode', async () => {
    const user = userEvent.setup();
    render(<AdminSkillsPanel />);
    await user.click(screen.getByRole('button', { name: 'Edit React' }));
    await user.click(screen.getByRole('button', { name: 'Delete React' }));
    await user.click(screen.getByRole('button', { name: 'YES, DELETE' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Add new skill' })).toBeInTheDocument());
  });

  it('a failed delete says so in the banner', async () => {
    hooks.remove.mutateAsync.mockRejectedValue({});
    const user = userEvent.setup();
    render(<AdminSkillsPanel />);
    await user.click(screen.getByRole('button', { name: 'Delete Docker' }));
    await user.click(screen.getByRole('button', { name: 'YES, DELETE' }));
    expect(await screen.findByText(/Delete: the server could not be reached/)).toBeInTheDocument();
  });
});

// ── PF-114 — drag-and-drop (owner, 2026-10-05) ───────────────────────────────
// jsdom has no layout, so getBoundingClientRect is all zeros: clientX 1 is the
// pill's RIGHT half ("drop after"), clientX -1 its LEFT half ("drop before").
//
// ⚠️ jsdom also has NO `DragEvent`. testing-library then builds a plain Event
// and silently DROPS `clientX`, so every drop reads as `undefined > 0` →
// "before" — and a "drops before" test passes against code that ignores the
// pointer entirely. Found because the "after" test failed. A DragEvent that is
// a MouseEvent carries clientX through; the mutation record pins both halves.
beforeAll(() => {
  if (!window.DragEvent) {
    window.DragEvent = class DragEvent extends MouseEvent {};
  }
});

describe('drag-and-drop', () => {
  const chipEl = (name) => screen.getByRole('button', { name: `Edit ${name}` }).closest('li');
  const box = (label) => within(listCard()).getByRole('list', { name: `${label} skills` });
  const dt = () => ({ effectAllowed: '', setData: vi.fn() });

  const drag = (name, onto, { before = false } = {}) => {
    fireEvent.dragStart(chipEl(name), { dataTransfer: dt() });
    const target = typeof onto === 'string' ? chipEl(onto) : onto;
    fireEvent.dragOver(target, { clientX: before ? -1 : 1, dataTransfer: dt() });
    fireEvent.drop(target, { dataTransfer: dt() });
  };

  it('pills are draggable while nothing is being edited', () => {
    render(<AdminSkillsPanel />);
    expect(chipEl('React')).toHaveAttribute('draggable', 'true');
  });

  it('STAGES a reorder within a box — shown at once, nothing sent — then SAVE ORDER sends it', async () => {
    const user = userEvent.setup();
    render(<AdminSkillsPanel />);
    drag('Next.js', 'React', { before: true });

    expect(chipNames('Frontend')).toEqual(['Next.js', 'React', 'Vite']);
    expect(hooks.reorder.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText('UNSAVED ORDER')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'SAVE ORDER' }));
    expect(hooks.reorder.mutateAsync).toHaveBeenCalledWith(['s3', 's1', 's2']);
    expect(hooks.update.mutateAsync).not.toHaveBeenCalled();
    await waitFor(() => expect(hooks.showFlash).toHaveBeenCalledWith('Order saved'));
  });

  it('drops AFTER a pill on its right half', () => {
    render(<AdminSkillsPanel />);
    drag('React', 'Vite');
    expect(chipNames('Frontend')).toEqual(['Vite', 'React', 'Next.js']);
  });

  it('a drag INTO another box moves the skill there; SAVE sends the move, then the order', async () => {
    const calls = [];
    hooks.update.mutateAsync.mockImplementation(async (arg) => { calls.push(['update', arg]); });
    hooks.reorder.mutateAsync.mockImplementation(async (ids) => { calls.push(['reorder', ids]); });
    const user = userEvent.setup();
    render(<AdminSkillsPanel />);
    drag('Vite', 'Docker', { before: true });

    expect(chipNames('Frontend')).toEqual(['React', 'Next.js']);
    expect(chipNames('DevOps')).toEqual(['Vite', 'Docker']);
    await user.click(screen.getByRole('button', { name: 'SAVE ORDER' }));
    await waitFor(() => expect(calls).toEqual([
      ['update', { id: 's2', data: { category: 'devops' } }],
      ['reorder', ['s1', 's3']],
      ['reorder', ['s2', 's9']],
    ]));
  });

  it('a drop on an EMPTY box puts the skill in it', () => {
    render(<AdminSkillsPanel />);
    fireEvent.dragStart(chipEl('Docker'), { dataTransfer: dt() });
    fireEvent.dragOver(box('Other'), { dataTransfer: dt() });
    fireEvent.drop(box('Other'), { dataTransfer: dt() });
    expect(chipNames('Other')).toEqual(['Docker']);
  });

  it('REVERT ORDER puts everything back', async () => {
    const user = userEvent.setup();
    render(<AdminSkillsPanel />);
    drag('Vite', 'Docker', { before: true });
    await user.click(screen.getByRole('button', { name: 'REVERT ORDER' }));
    expect(chipNames('Frontend')).toEqual(['React', 'Vite', 'Next.js']);
    expect(screen.queryByText('UNSAVED ORDER')).toBeNull();
  });

  // ⚠️ Opening a skill resets the staged layout — so while an order is
  // unsaved, a chip click must not be able to throw it away.
  it('chips cannot be opened for editing while an order is unsaved', () => {
    render(<AdminSkillsPanel />);
    drag('Next.js', 'React', { before: true });
    expect(screen.getByRole('button', { name: 'Edit React' })).toBeDisabled();
    expect(screen.getByText('Save or revert the new order before editing a skill.')).toBeInTheDocument();
  });

  it('dragging is off while a skill is open in the edit card', async () => {
    const user = userEvent.setup();
    render(<AdminSkillsPanel />);
    await user.click(screen.getByRole('button', { name: 'Edit React' }));
    expect(chipEl('Vite')).toHaveAttribute('draggable', 'false');
    expect(screen.getByText('Dragging is paused while a skill is open above.')).toBeInTheDocument();
  });

  it('a failed SAVE ORDER keeps the arrangement staged and says why', async () => {
    hooks.reorder.mutateAsync.mockRejectedValue(httpError(400, 'Send every skill in the category, in the new order'));
    const user = userEvent.setup();
    render(<AdminSkillsPanel />);
    drag('Next.js', 'React', { before: true });
    await user.click(screen.getByRole('button', { name: 'SAVE ORDER' }));
    expect(await screen.findByText(/Order: Send every skill/)).toBeInTheDocument();
    expect(chipNames('Frontend')).toEqual(['Next.js', 'React', 'Vite']);
    expect(hooks.showFlash).not.toHaveBeenCalled();
  });
});
