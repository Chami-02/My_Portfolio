// frontend/src/components/admin/panels/__tests__/AdminProjectsPanel.test.jsx
//
// PF-113 — the rebuilt Projects panel. Behaviour, not pixels. The panel had no
// test at all before this ticket.
//
// ⚠️ Every staging assertion is a PAIR — "nothing was sent on pick" AND "SAVE
// then sends it" — because the first half alone passes against a panel that
// never sends anything. Same discipline as AdminAboutPanel.test.jsx.
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mocked at the MODULE level: Vite's SSR transform makes exports getter-only,
// so vi.spyOn cannot redefine them.
const hooks = vi.hoisted(() => ({
  useAdminProjects: vi.fn(),
  create:   { mutateAsync: vi.fn(), isPending: false },
  update:   { mutateAsync: vi.fn(), isPending: false },
  remove:   { mutateAsync: vi.fn(), isPending: false },
  uploadBg: { mutateAsync: vi.fn(), isPending: false },
  removeBg: { mutateAsync: vi.fn(), isPending: false },
  vocab:    vi.fn(),
  createVocab: { mutateAsync: vi.fn(), isPending: false },
  deleteVocab: { mutateAsync: vi.fn(), isPending: false },
  impact:   vi.fn(),
  showFlash: vi.fn(),
}));

vi.mock('../../../../hooks/useProjects', () => ({
  useAdminProjects:    hooks.useAdminProjects,
  useCreateProject:    () => hooks.create,
  useUpdateProject:    () => hooks.update,
  useDeleteProject:    () => hooks.remove,
  useUploadBackground: () => hooks.uploadBg,
  useRemoveBackground: () => hooks.removeBg,
}));

vi.mock('../../../../hooks/useVocabulary', () => ({
  useVocabulary:       hooks.vocab,
  useCreateVocabulary: () => hooks.createVocab,
  useDeleteVocabulary: () => hooks.deleteVocab,
  useVocabularyImpact: hooks.impact,
}));

// jsdom has no canvas — the browser-side resize is a passthrough by default.
const resize = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock('../../../../utils/resizeImage', async (orig) => ({
  ...(await orig()),
  resizeImage: resize.fn,
}));

vi.mock('../../../../hooks/useAdminFlash', () => ({
  useAdminFlash: () => ({ showFlash: hooks.showFlash }),
}));

const { AdminProjectsPanel } = await import('../AdminProjectsPanel');

const LIVE = Object.freeze({
  _id: 'p1', title: 'ClearDrive', description: 'A car marketplace.',
  tech: ['React', 'Docker'], githubUrl: 'https://github.com/a/cleardrive', liveUrl: null,
  order: 0, featured: true, published: true,
  backgroundImage: { src: 'https://cdn.test/bg.webp', publicId: 'projects/bg', opacity: 0.4 },
});

const DRAFT = Object.freeze({
  _id: 'p2', title: 'Half-written', description: '', tech: [], githubUrl: '', liveUrl: null,
  order: 1, featured: false, published: false,
  backgroundImage: { src: '', publicId: '', opacity: 0.75 },
});

const TECH = [
  { _id: 't1', type: 'tech', value: 'React' },
  { _id: 't2', type: 'tech', value: 'Docker' },
  { _id: 't3', type: 'tech', value: 'Redis' },
];

const webp = (name = 'bg.webp') => new File([new Uint8Array([82, 73, 70, 70])], name, { type: 'image/webp' });

const formCard = () => screen.getByRole('heading', { name: /new project|edit project/i }).closest('section');
const field = (label) => within(formCard()).getByLabelText(label);
const btn = (name) => within(formCard()).getByRole('button', { name });
const queryBtn = (name) => within(formCard()).queryByRole('button', { name });
const fileInput = () => formCard().querySelector('input[type="file"]');
const editRow = (title) => screen.getByRole('button', { name: `Edit ${title}` });
const httpError = (status, message) => ({ response: { status, data: { message } } });

/** Fill a complete, publishable new project. */
const fillComplete = async (user) => {
  await user.type(field('Title'), 'Portfolio');
  await user.type(field('GitHub URL'), 'https://github.com/a/portfolio');
  await user.type(field('Description'), 'This site.');
  await user.type(field('Tech stack (comma separated)'), 'React');
};

beforeEach(() => {
  vi.clearAllMocks();
  hooks.useAdminProjects.mockReturnValue({ data: [LIVE, DRAFT], isLoading: false });
  hooks.create.mutateAsync = vi.fn().mockResolvedValue({ _id: 'new1' });
  hooks.update.mutateAsync = vi.fn().mockResolvedValue({});
  hooks.remove.mutateAsync = vi.fn().mockResolvedValue({});
  hooks.uploadBg.mutateAsync = vi.fn().mockResolvedValue({});
  hooks.removeBg.mutateAsync = vi.fn().mockResolvedValue({});
  hooks.deleteVocab.mutateAsync = vi.fn().mockResolvedValue({ strippedFrom: 1 });
  hooks.vocab.mockReturnValue({ data: TECH, isLoading: false });
  hooks.impact.mockReturnValue({ data: { affected: 2, label: 'projects' }, isLoading: false, isError: false });
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
  window.scrollTo = vi.fn();
  resize.fn.mockImplementation(async (file) => ({ file, resized: false }));
});

/** The background block — the DropZone's own element wraps its media row. */
const bgBlock = () => screen.getByText(/Card background image/).closest('div').parentElement;
const dropZone = () => screen.getByTestId('bg-preview').closest('[class*="dropZone"]');
const dropFiles = (target, files) => {
  const dataTransfer = { files, types: ['Files'], dropEffect: '' };
  fireEvent.dragEnter(target, { dataTransfer });
  fireEvent.drop(target, { dataTransfer });
};

// ─────────────────────────────────────────────────────────────────────────────
describe('the list', () => {
  it('lists every project the ADMIN endpoint returns, drafts included', () => {
    render(<AdminProjectsPanel />);

    expect(screen.getByRole('heading', { name: 'All projects (2)' })).toBeInTheDocument();
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('★ FEATURED')).toBeInTheDocument();
    expect(within(rows[0]).queryByText('DRAFT')).not.toBeInTheDocument();
    expect(within(rows[1]).getByText('DRAFT')).toBeInTheDocument();
  });

  it('shows an empty state', () => {
    hooks.useAdminProjects.mockReturnValue({ data: [], isLoading: false });
    render(<AdminProjectsPanel />);
    expect(screen.getByText(/No projects yet/)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('creating — ADD PROJECT and SAVE AS DRAFT', () => {
  it('both are dim on an untouched form', () => {
    render(<AdminProjectsPanel />);
    expect(btn('ADD PROJECT')).toBeDisabled();
    expect(btn('SAVE AS DRAFT')).toBeDisabled();
  });

  // The owner's rule: a draft needs only a title.
  it('SAVE AS DRAFT sends a title-only project with published:false', async () => {
    const user = userEvent.setup();
    render(<AdminProjectsPanel />);

    await user.type(field('Title'), 'Idea');
    await user.click(btn('SAVE AS DRAFT'));

    await waitFor(() => expect(hooks.create.mutateAsync).toHaveBeenCalledTimes(1));
    expect(hooks.create.mutateAsync.mock.calls[0][0]).toMatchObject({ title: 'Idea', published: false, tech: [] });
    expect(hooks.showFlash).toHaveBeenCalledWith('Draft saved');
  });

  it('SAVE AS DRAFT with no title is refused, sends nothing, and marks the title', async () => {
    const user = userEvent.setup();
    render(<AdminProjectsPanel />);

    await user.type(field('Description'), 'words');
    await user.click(btn('SAVE AS DRAFT'));

    expect(hooks.create.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText(/1 field needs attention/)).toBeInTheDocument();
    expect(field('Title')).toHaveAttribute('aria-invalid', 'true');
    expect(field('GitHub URL')).not.toHaveAttribute('aria-invalid');
  });

  it('ADD PROJECT on the same title-only form is refused for the publish fields', async () => {
    const user = userEvent.setup();
    render(<AdminProjectsPanel />);

    await user.type(field('Title'), 'Idea');
    await user.click(btn('ADD PROJECT'));

    expect(hooks.create.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText(/3 fields need attention/)).toBeInTheDocument();
    for (const label of ['GitHub URL', 'Description', 'Tech stack (comma separated)']) {
      expect(field(label)).toHaveAttribute('aria-invalid', 'true');
    }
    // The SAVE button stays pressable — validity never disables it.
    expect(btn('ADD PROJECT')).toBeEnabled();
  });

  it('the refused button is the one that shakes', async () => {
    const user = userEvent.setup();
    render(<AdminProjectsPanel />);

    await user.type(field('Title'), 'Idea');
    await user.click(btn('ADD PROJECT'));

    expect(btn('ADD PROJECT').className).toMatch(/shake/);
    expect(btn('SAVE AS DRAFT').className).not.toMatch(/shake/);
  });

  it('typing in a marked field clears ITS mark only', async () => {
    const user = userEvent.setup();
    render(<AdminProjectsPanel />);

    await user.type(field('Title'), 'Idea');
    await user.click(btn('ADD PROJECT'));
    await user.type(field('GitHub URL'), 'h');

    expect(field('GitHub URL')).not.toHaveAttribute('aria-invalid');
    expect(field('Description')).toHaveAttribute('aria-invalid', 'true');
  });

  it('ADD PROJECT publishes a complete project and returns to a blank form', async () => {
    const user = userEvent.setup();
    render(<AdminProjectsPanel />);

    await fillComplete(user);
    await user.click(btn('ADD PROJECT'));

    await waitFor(() => expect(hooks.showFlash).toHaveBeenCalledWith('Project added'));
    expect(hooks.create.mutateAsync.mock.calls[0][0]).toMatchObject({
      title: 'Portfolio', published: true, tech: ['React'], backgroundImage: { opacity: 0.75 },
    });
    expect(field('Title')).toHaveValue('');
  });

  it('refuses a javascript: URL even on a draft', async () => {
    const user = userEvent.setup();
    render(<AdminProjectsPanel />);

    await user.type(field('Title'), 'Idea');
    await user.type(field('Live URL'), 'javascript:alert(1)');
    await user.click(btn('SAVE AS DRAFT'));

    expect(hooks.create.mutateAsync).not.toHaveBeenCalled();
    expect(field('Live URL')).toHaveAttribute('aria-invalid', 'true');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('editing, REVERT and CANCEL EDIT', () => {
  it('EDIT loads the saved values', async () => {
    const user = userEvent.setup();
    render(<AdminProjectsPanel />);

    await user.click(editRow('ClearDrive'));

    expect(screen.getByRole('heading', { name: 'Edit project' })).toBeInTheDocument();
    expect(field('Title')).toHaveValue('ClearDrive');
    expect(field('Tech stack (comma separated)')).toHaveValue('React, Docker');
    expect(screen.getByRole('slider', { name: 'Image visibility' })).toHaveValue('40');
  });

  // ⚠️ THE OWNER'S BUG. The old cancelEdit set the form to EMPTY.
  it('REVERT CHANGES restores the SAVED values — it never empties the form', async () => {
    const user = userEvent.setup();
    render(<AdminProjectsPanel />);

    await user.click(editRow('ClearDrive'));
    await user.clear(field('Title'));
    await user.type(field('Title'), 'Typo');
    await user.click(btn('REVERT CHANGES'));

    expect(field('Title')).toHaveValue('ClearDrive');
    expect(screen.getByRole('heading', { name: 'Edit project' })).toBeInTheDocument();
    expect(queryBtn('REVERT CHANGES')).not.toBeInTheDocument();
  });

  it('REVERT discards a staged background too — no half-revert', async () => {
    const user = userEvent.setup();
    render(<AdminProjectsPanel />);

    await user.click(editRow('ClearDrive'));
    await user.upload(fileInput(), webp());
    expect(within(formCard()).getByText('PENDING SAVE')).toBeInTheDocument();

    await user.click(btn('REVERT CHANGES'));

    expect(within(formCard()).getByText('LIVE')).toBeInTheDocument();
    // And SAVE no longer has anything to send.
    expect(btn('SAVE CHANGES')).toBeDisabled();
  });

  it('CANCEL EDIT leaves edit mode for a blank new form, saving nothing', async () => {
    const user = userEvent.setup();
    render(<AdminProjectsPanel />);

    await user.click(editRow('ClearDrive'));
    await user.type(field('Title'), ' v2');
    await user.click(btn('CANCEL EDIT'));

    expect(screen.getByRole('heading', { name: 'Add new project' })).toBeInTheDocument();
    expect(field('Title')).toHaveValue('');
    expect(hooks.update.mutateAsync).not.toHaveBeenCalled();
  });

  it('SAVE CHANGES sends the edit as published', async () => {
    const user = userEvent.setup();
    render(<AdminProjectsPanel />);

    await user.click(editRow('ClearDrive'));
    await user.type(field('Title'), ' v2');
    await user.click(btn('SAVE CHANGES'));

    await waitFor(() => expect(hooks.update.mutateAsync).toHaveBeenCalledTimes(1));
    expect(hooks.update.mutateAsync.mock.calls[0][0]).toMatchObject({
      id: 'p1', data: { title: 'ClearDrive v2', published: true },
    });
    expect(hooks.showFlash).toHaveBeenCalledWith('Project updated');
  });

  it('a published project offers no draft button', async () => {
    const user = userEvent.setup();
    render(<AdminProjectsPanel />);
    await user.click(editRow('ClearDrive'));
    expect(queryBtn(/DRAFT/)).not.toBeInTheDocument();
  });

  // The one exception to "dim until dirty": publishing IS the change.
  it('PUBLISH is lit on an UNTOUCHED draft; SAVE DRAFT is not', async () => {
    const user = userEvent.setup();
    render(<AdminProjectsPanel />);

    await user.click(editRow('Half-written'));

    expect(btn('PUBLISH')).toBeEnabled();
    expect(btn('SAVE DRAFT')).toBeDisabled();
  });

  it('PUBLISH on an incomplete draft is refused with nothing sent', async () => {
    const user = userEvent.setup();
    render(<AdminProjectsPanel />);

    await user.click(editRow('Half-written'));
    await user.click(btn('PUBLISH'));

    expect(hooks.update.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText(/3 fields need attention/)).toBeInTheDocument();
  });

  it('deleting the project being edited leaves edit mode', async () => {
    const user = userEvent.setup();
    render(<AdminProjectsPanel />);

    await user.click(editRow('ClearDrive'));
    await user.click(screen.getByRole('button', { name: 'Delete ClearDrive' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'YES, DELETE' }));

    await waitFor(() => expect(hooks.remove.mutateAsync).toHaveBeenCalledWith('p1'));
    expect(screen.getByRole('heading', { name: 'Add new project' })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the background — staged until SAVE', () => {
  it('a pick uploads NOTHING; SAVE then uploads it to that project', async () => {
    const user = userEvent.setup();
    render(<AdminProjectsPanel />);

    await user.click(editRow('ClearDrive'));
    await user.upload(fileInput(), webp());

    expect(hooks.uploadBg.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByTestId('bg-preview').style.backgroundImage).toContain('blob:preview');

    await user.click(btn('SAVE CHANGES'));

    await waitFor(() => expect(hooks.uploadBg.mutateAsync).toHaveBeenCalledTimes(1));
    expect(hooks.uploadBg.mutateAsync.mock.calls[0][0]).toMatchObject({ id: 'p1' });
    expect(hooks.uploadBg.mutateAsync.mock.calls[0][0].file.name).toBe('bg.webp');
  });

  it('a NEW project is created first, then its background uploads with the new id', async () => {
    const user = userEvent.setup();
    const order = [];
    hooks.create.mutateAsync = vi.fn(async () => { order.push('create'); return { _id: 'new1' }; });
    hooks.uploadBg.mutateAsync = vi.fn(async () => { order.push('upload'); });
    render(<AdminProjectsPanel />);

    await user.type(field('Title'), 'Idea');
    await user.upload(fileInput(), webp());
    await user.click(btn('SAVE AS DRAFT'));

    await waitFor(() => expect(order).toEqual(['create', 'upload']));
    expect(hooks.uploadBg.mutateAsync.mock.calls[0][0].id).toBe('new1');
  });

  it('CLEAR on a stored image stages a removal; SAVE performs it', async () => {
    const user = userEvent.setup();
    render(<AdminProjectsPanel />);

    await user.click(editRow('ClearDrive'));
    await user.click(btn('CLEAR'));

    expect(hooks.removeBg.mutateAsync).not.toHaveBeenCalled();
    expect(within(formCard()).getByText('REMOVE ON SAVE')).toBeInTheDocument();

    await user.click(btn('SAVE CHANGES'));
    await waitFor(() => expect(hooks.removeBg.mutateAsync).toHaveBeenCalledWith('p1'));
  });

  it('refuses a wrong file type at pick time, keeping what was staged', async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<AdminProjectsPanel />);

    await user.click(editRow('ClearDrive'));
    await user.upload(fileInput(), webp());
    await user.upload(fileInput(), new File(['x'], 'logo.svg', { type: 'image/svg+xml' }));

    // ⚠️ INSIDE the background block, not the banner at the top of the form.
    expect(await within(bgBlock()).findByRole('alert'))
      .toHaveTextContent('Background must be a PNG, JPEG or WEBP image.');
    expect(within(formCard()).getByText('PENDING SAVE')).toBeInTheDocument();
  });

  // ── PF-113 batch 2 ─────────────────────────────────────────────────────────
  it('a large photo is resized, staged, and labelled with its original size', async () => {
    const user = userEvent.setup();
    resize.fn.mockResolvedValue({
      file: new File([new Uint8Array(400 * 1024)], 'bg.webp', { type: 'image/webp' }), resized: true });
    render(<AdminProjectsPanel />);

    await user.click(editRow('ClearDrive'));
    await user.upload(fileInput(), new File([new Uint8Array(8 * 1024 * 1024)], 'phone.jpg', { type: 'image/jpeg' }));

    expect(await within(bgBlock()).findByText(/bg\.webp · 400 KB · resized from 8\.0 MB · not saved yet/))
      .toBeInTheDocument();
  });

  it('a DROPPED file goes through the same checks — an SVG is refused inside the block', async () => {
    const user = userEvent.setup();
    render(<AdminProjectsPanel />);
    await user.click(editRow('ClearDrive'));

    dropFiles(dropZone(), [new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' })]);

    expect(await within(bgBlock()).findByRole('alert'))
      .toHaveTextContent('Background must be a PNG, JPEG or WEBP image.');
    expect(within(formCard()).getByText('LIVE')).toBeInTheDocument();
  });

  it('a DROPPED image is staged exactly like a picked one, and SAVE uploads it', async () => {
    const user = userEvent.setup();
    render(<AdminProjectsPanel />);
    await user.click(editRow('ClearDrive'));

    dropFiles(dropZone(), [webp('dropped.webp')]);

    expect(await within(formCard()).findByText('PENDING SAVE')).toBeInTheDocument();
    expect(hooks.uploadBg.mutateAsync).not.toHaveBeenCalled();
    await user.click(btn('SAVE CHANGES'));
    await waitFor(() => expect(hooks.uploadBg.mutateAsync).toHaveBeenCalledTimes(1));
    expect(hooks.uploadBg.mutateAsync.mock.calls[0][0].file.name).toBe('dropped.webp');
  });

  it('an unexpected failure while preparing is reported, not swallowed', async () => {
    const user = userEvent.setup();
    resize.fn.mockRejectedValue(new TypeError('canvas exploded'));
    render(<AdminProjectsPanel />);
    await user.click(editRow('ClearDrive'));

    await user.upload(fileInput(), webp());

    expect(await within(bgBlock()).findByRole('alert'))
      .toHaveTextContent('This file could not be prepared for upload — try another file.');
    expect(within(formCard()).getByText('LIVE')).toBeInTheDocument();
  });

  it('dropping two files at once is refused with a message', async () => {
    const user = userEvent.setup();
    render(<AdminProjectsPanel />);
    await user.click(editRow('ClearDrive'));

    dropFiles(dropZone(), [webp('a.webp'), webp('b.webp')]);

    expect(await within(bgBlock()).findByRole('alert')).toHaveTextContent('Drop one file at a time.');
  });

  it('the slider moves the preview live and is saved as a 0.x opacity', async () => {
    const user = userEvent.setup();
    render(<AdminProjectsPanel />);

    await user.click(editRow('ClearDrive'));
    fireEvent.change(screen.getByRole('slider', { name: 'Image visibility' }), { target: { value: '85' } });

    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByTestId('bg-preview').style.opacity).toBe('0.85');

    await user.click(btn('SAVE CHANGES'));
    await waitFor(() => expect(hooks.update.mutateAsync).toHaveBeenCalled());
    expect(hooks.update.mutateAsync.mock.calls[0][0].data.backgroundImage).toEqual({ opacity: 0.85 });
  });

  // ⚠️ Never a "saved" flash for a half-saved project.
  it('a failed upload after a successful create keeps the owner on the new project, file still staged', async () => {
    const user = userEvent.setup();
    hooks.uploadBg.mutateAsync = vi.fn().mockRejectedValue(httpError(503, 'File storage is not configured on this server'));
    hooks.useAdminProjects.mockReturnValue({
      data: [LIVE, DRAFT, { ...DRAFT, _id: 'new1', title: 'Idea' }], isLoading: false,
    });
    render(<AdminProjectsPanel />);

    await user.type(field('Title'), 'Idea');
    await user.upload(fileInput(), webp());
    await user.click(btn('SAVE AS DRAFT'));

    expect(await screen.findByText(/Draft saved\. Background: File storage is not configured/)).toBeInTheDocument();
    expect(hooks.showFlash).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Edit project' })).toBeInTheDocument();
    expect(field('Title')).toHaveValue('Idea');
    expect(within(formCard()).getByText('PENDING SAVE')).toBeInTheDocument();
  });

  it('a dead backend is named as such, not as a rejected project', async () => {
    const user = userEvent.setup();
    hooks.create.mutateAsync = vi.fn().mockRejectedValue(new Error('Network Error'));
    render(<AdminProjectsPanel />);

    await user.type(field('Title'), 'Idea');
    await user.click(btn('SAVE AS DRAFT'));

    expect(await screen.findByText(/server could not be reached/)).toBeInTheDocument();
    expect(hooks.uploadBg.mutateAsync).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the tech picker', () => {
  it('reads the TECH vocabulary', () => {
    render(<AdminProjectsPanel />);
    expect(hooks.vocab).toHaveBeenCalledWith('tech');
  });

  it('picking a chip writes it into the tech field and makes the form dirty', async () => {
    const user = userEvent.setup();
    render(<AdminProjectsPanel />);

    await user.click(within(formCard()).getByRole('button', { name: '+ Redis' }));

    expect(field('Tech stack (comma separated)')).toHaveValue('Redis');
    expect(btn('SAVE AS DRAFT')).toBeEnabled();
  });

  it('× deletes through the impact-count confirm and strips the value from the open form', async () => {
    const user = userEvent.setup();
    render(<AdminProjectsPanel />);

    await user.click(editRow('ClearDrive'));
    await user.click(screen.getByRole('button', { name: 'Remove Docker from the tech list' }));

    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText(/removes it from 2 projects/)).toBeInTheDocument();
    // The dialog sits inside the project <form>: confirming must not submit it.
    await user.click(dialog.getByRole('button', { name: 'YES, REMOVE' }));

    await waitFor(() => expect(hooks.deleteVocab.mutateAsync).toHaveBeenCalledWith('t2'));
    expect(field('Tech stack (comma separated)')).toHaveValue('React');
    expect(hooks.update.mutateAsync).not.toHaveBeenCalled();
  });
});
