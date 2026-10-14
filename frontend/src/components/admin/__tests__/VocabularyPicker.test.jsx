// PF-113 — the shared chip picker, here for its `type` parameter. The tag
// behaviour is covered end to end by AdminBlogPanel.test.jsx (unchanged apart
// from the dialog's button casing), the tech behaviour by
// AdminProjectsPanel.test.jsx.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const hooks = vi.hoisted(() => ({
  list: vi.fn(),
  impact: vi.fn(),
  create: { mutateAsync: vi.fn(), isPending: false },
  remove: { mutateAsync: vi.fn(), isPending: false },
  createdFor: [],
  deletedFor: [],
}));

vi.mock('../../../hooks/useVocabulary', () => ({
  useVocabulary: hooks.list,
  useVocabularyImpact: hooks.impact,
  useCreateVocabulary: (type) => { hooks.createdFor.push(type); return hooks.create; },
  useDeleteVocabulary: (type) => { hooks.deletedFor.push(type); return hooks.remove; },
}));

const { VocabularyPicker } = await import('../VocabularyPicker');

beforeEach(() => {
  vi.clearAllMocks();
  hooks.createdFor.length = 0;
  hooks.deletedFor.length = 0;
  hooks.list.mockReturnValue({ data: [{ _id: 'a', value: 'Redis' }], isLoading: false });
  hooks.impact.mockReturnValue({ data: undefined, isLoading: true, isError: false });
  hooks.create.mutateAsync = vi.fn().mockResolvedValue({ value: 'Go' });
});

const renderPicker = (type, selected = '') => {
  const onToggle = vi.fn();
  render(<VocabularyPicker type={type} selected={selected} onToggle={onToggle}
    onRemoved={() => {}} onError={() => {}} />);
  return { onToggle };
};

describe('VocabularyPicker', () => {
  // ⚠️ The type must reach EVERY hook — a picker reading 'tech' and deleting
  // from 'tag' would cascade a delete across the wrong collection.
  it.each(['tag', 'tech'])('wires every hook to type %s', (type) => {
    renderPicker(type);
    expect(hooks.list).toHaveBeenCalledWith(type);
    expect(hooks.createdFor).toContain(type);
    expect(hooks.deletedFor).toContain(type);
    expect(hooks.createdFor.every((t) => t === type)).toBe(true);
    expect(hooks.deletedFor.every((t) => t === type)).toBe(true);
  });

  it.each([
    ['tag',  '+ ADD TAG',  'New tag name',  'Remove Redis from the tag list'],
    ['tech', '+ ADD TECH', 'New tech name', 'Remove Redis from the tech list'],
  ])('names its controls for %s', (type, add, input, remove) => {
    renderPicker(type);
    expect(screen.getByRole('button', { name: add })).toBeInTheDocument();
    expect(screen.getByLabelText(input)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: remove })).toBeInTheDocument();
  });

  it('marks a selected chip, case-insensitively', () => {
    renderPicker('tech', 'redis');
    expect(screen.getByRole('button', { name: '✓ Redis' })).toHaveAttribute('aria-pressed', 'true');
  });

  // The count is the whole point of the confirm; "0" while loading would lie.
  it('keeps YES, REMOVE disabled until the impact count arrives', async () => {
    const user = userEvent.setup();
    renderPicker('tech');
    await user.click(screen.getByRole('button', { name: 'Remove Redis from the tech list' }));

    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText('Checking how many projects use it…')).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'YES, REMOVE' })).toBeDisabled();
  });

  it('adding a value picks it for the record', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderPicker('tech');
    await user.type(screen.getByLabelText('New tech name'), 'Go{Enter}');
    expect(hooks.create.mutateAsync).toHaveBeenCalledWith('Go');
    expect(onToggle).toHaveBeenCalledWith('Go');
  });
});
