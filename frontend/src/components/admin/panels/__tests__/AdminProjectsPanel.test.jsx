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
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { renderWithGuard } from '../../../../test/renderWithGuard';

// Mocked at the MODULE level: Vite's SSR transform makes exports getter-only,
// so vi.spyOn cannot redefine them.
const hooks = vi.hoisted(() => ({
  useAdminProjects: vi.fn(),
  create:   { mutateAsync: vi.fn(), isPending: false },
  update:   { mutateAsync: vi.fn(), isPending: false },
  remove:   { mutateAsync: vi.fn(), isPending: false },
  uploadBg: { mutateAsync: vi.fn(), isPending: false },
  uploadPic: { mutateAsync: vi.fn(), isPending: false },
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
  useUploadSectionImage: () => hooks.uploadPic,
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
  order: 0, featured: true, published: true, slug: 'cleardrive',
  categories: ['Web App'], role: 'Team lead', client: '', startedOn: '2024-02', endedOn: '', ongoing: true,
  sections: [{ heading: 'Description', body: ['A car marketplace.'], bullets: [] }],
  backgroundImage: { src: 'https://cdn.test/bg.webp', publicId: 'projects/bg', opacity: 0.4 },
});

const DRAFT = Object.freeze({
  _id: 'p2', title: 'Half-written', description: '', tech: [], githubUrl: '', liveUrl: null,
  order: 1, featured: false, published: false,
  backgroundImage: { src: '', publicId: '', opacity: 0.75 },
});

const CATEGORIES = [
  { _id: 'c1', type: 'category', value: 'Web App' },
  { _id: 'c2', type: 'category', value: 'API' },
];

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
// The COVER picture's input, by id — since PF-144 part 2 each section has one too.
const fileInput = () => formCard().querySelector('#project-background-file');
const editRow = (title) => screen.getByRole('button', { name: `Edit ${title}` });
const httpError = (status, message) => ({ response: { status, data: { message } } });

/** The summary box — its label goes on to say where it shows. */
const SUMMARY = /^Summary/;

/** Fill a complete, publishable new project — the three starter sections too. */
const fillComplete = async (user) => {
  await user.type(field('Title'), 'Portfolio');
  await user.type(field('GitHub URL'), 'https://github.com/a/portfolio');
  await user.type(field(SUMMARY), 'This site.');
  await user.type(field('Tech stack (comma separated)'), 'React');
  await user.type(field('Section 01, paragraph 1'), 'What it is.');
  await user.type(field('Section 02, bullet 1'), 'Fast.');
  await user.type(field('Section 03, paragraph 1'), 'What it changed.');
};

beforeEach(() => {
  vi.clearAllMocks();
  hooks.useAdminProjects.mockReturnValue({ data: [LIVE, DRAFT], isLoading: false });
  hooks.create.mutateAsync = vi.fn().mockResolvedValue({ _id: 'new1' });
  hooks.update.mutateAsync = vi.fn().mockResolvedValue({});
  hooks.remove.mutateAsync = vi.fn().mockResolvedValue({});
  hooks.uploadBg.mutateAsync = vi.fn().mockResolvedValue({});
  hooks.uploadPic.mutateAsync = vi.fn(async ({ file }) => ({
    publicId: `p/${file.name}`, url: `https://res.cloudinary.com/x/${file.name}`, width: 1920, height: 1080,
  }));
  hooks.removeBg.mutateAsync = vi.fn().mockResolvedValue({});
  hooks.deleteVocab.mutateAsync = vi.fn().mockResolvedValue({ strippedFrom: 1 });
  hooks.vocab.mockImplementation((type) => ({ data: type === 'category' ? CATEGORIES : TECH, isLoading: false }));
  hooks.impact.mockReturnValue({ data: { affected: 2, label: 'projects' }, isLoading: false, isError: false });
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
  window.scrollTo = vi.fn();
  resize.fn.mockImplementation(async (file) => ({ file, resized: false }));
});

/** The background block — the DropZone's own element wraps its media row. */
const bgBlock = () => screen.getByText(/Project picture/).closest('div').parentElement;
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

    await user.type(field(SUMMARY), 'words');
    await user.click(btn('SAVE AS DRAFT'));

    expect(hooks.create.mutateAsync).not.toHaveBeenCalled();
    // The banner NAMES the field (owner, 2026-10-31).
    expect(screen.getByText(/CHECK THE CHANGES AGAIN — Title needs attention\./)).toBeInTheDocument();
    expect(field('Title')).toHaveAttribute('aria-invalid', 'true');
    expect(field('GitHub URL')).not.toHaveAttribute('aria-invalid');
  });

  it('ADD PROJECT on the same title-only form is refused for the publish fields', async () => {
    const user = userEvent.setup();
    render(<AdminProjectsPanel />);

    await user.type(field('Title'), 'Idea');
    await user.click(btn('ADD PROJECT'));

    expect(hooks.create.mutateAsync).not.toHaveBeenCalled();
    // The untouched starter sections are named too — each heading has no text yet.
    expect(screen.getByText(
      /Summary, Section 01, Section 02, Section 03, Tech stack, GitHub URL need attention\./,
    )).toBeInTheDocument();
    for (const label of ['GitHub URL', SUMMARY, 'Tech stack (comma separated)']) {
      expect(field(label)).toHaveAttribute('aria-invalid', 'true');
    }
    for (const heading of within(formCard()).getAllByLabelText('Heading *')) {
      expect(heading).toHaveAttribute('aria-invalid', 'true');
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
    // The refusal focuses the FIRST problem a frame later — wait for it, or
    // in a slow run that focus lands mid-typing and steals the keystroke.
    await waitFor(() => expect(field(SUMMARY)).toHaveFocus());
    await user.type(field('GitHub URL'), 'h');

    expect(field('GitHub URL')).not.toHaveAttribute('aria-invalid');
    expect(field(SUMMARY)).toHaveAttribute('aria-invalid', 'true');
  });

  it('ADD PROJECT publishes a complete project and returns to a blank form', async () => {
    const user = userEvent.setup();
    render(<AdminProjectsPanel />);

    await fillComplete(user);
    await user.click(btn('ADD PROJECT'));

    await waitFor(() => expect(hooks.showFlash).toHaveBeenCalledWith('Project added'));
    const sent = hooks.create.mutateAsync.mock.calls[0][0];
    expect(sent).toMatchObject({
      title: 'Portfolio', published: true, tech: ['React'],
      sections: [
        { heading: 'Description', body: ['What it is.'], bullets: [] },
        { heading: 'Key Features', body: [], bullets: ['Fast.'] },
        { heading: 'Outcome & Impact', body: ['What it changed.'], bullets: [] },
      ],
    });
    expect(sent).not.toHaveProperty('backgroundImage');
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
    expect(field(SUMMARY)).toHaveValue('A car marketplace.');
    expect(field('Role')).toHaveValue('Team lead');
    expect(field('Section 01, paragraph 1')).toHaveValue('A car marketplace.');
    expect(within(formCard()).getByRole('checkbox', { name: /Ongoing/ })).toBeChecked();
    // PF-144: no slider — the picture is not behind the text any more.
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
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
    expect(screen.getByText(/Summary, Sections, Tech stack, GitHub URL need attention\./)).toBeInTheDocument();
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
      .toHaveTextContent('Picture must be a PNG, JPEG or WEBP image.');
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
      .toHaveTextContent('Picture must be a PNG, JPEG or WEBP image.');
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

  // ⚠️ Never a "saved" flash for a half-saved project.
  it('a failed upload after a successful create keeps the owner on the new project, file still staged', async () => {
    const user = userEvent.setup();
    hooks.uploadBg.mutateAsync = vi.fn().mockRejectedValue(httpError(503, "Pictures can't be uploaded right now. Please try again later."));
    hooks.useAdminProjects.mockReturnValue({
      data: [LIVE, DRAFT, { ...DRAFT, _id: 'new1', title: 'Idea' }], isLoading: false,
    });
    render(<AdminProjectsPanel />);

    await user.type(field('Title'), 'Idea');
    await user.upload(fileInput(), webp());
    await user.click(btn('SAVE AS DRAFT'));

    expect(await screen.findByText(/Draft saved\. Background: Pictures can't be uploaded right now/)).toBeInTheDocument();
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

    expect(await screen.findByText(/We can't connect right now/)).toBeInTheDocument();
    expect(hooks.uploadBg.mutateAsync).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the tech picker', () => {
  it('reads the TECH vocabulary', () => {
    render(<AdminProjectsPanel />);
    expect(hooks.vocab).toHaveBeenCalledWith('tech');
  });

  // Found in the browser: the plural was built as `${one}s` → "categorys".
  it('an empty CATEGORY list says "No categories", spelled right', () => {
    hooks.vocab.mockImplementation((type) => ({ data: type === 'category' ? [] : TECH, isLoading: false }));
    render(<AdminProjectsPanel />);
    expect(screen.getByText(/No categories in the list yet/)).toBeInTheDocument();
  });

  // PF-144 — the label on the card's picture.
  it('the CATEGORY picker takes ONE value: a second pick replaces the first', async () => {
    const user = userEvent.setup();
    render(<AdminProjectsPanel />);
    expect(hooks.vocab).toHaveBeenCalledWith('category');

    const picker = within(formCard()).getByRole('group', { name: 'Category' });
    await user.click(within(picker).getByRole('button', { name: '+ Web App' }));
    await user.click(within(picker).getByRole('button', { name: '+ API' }));
    await user.type(field('Title'), 'X');
    await user.click(btn('SAVE AS DRAFT'));

    await waitFor(() => expect(hooks.create.mutateAsync).toHaveBeenCalled());
    expect(hooks.create.mutateAsync.mock.calls[0][0].categories).toEqual(['API']);
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

// PF-117 — a failed load used to fall through to the EMPTY state: "No
// projects yet", count (0), measured with the backend stopped.
describe('when the projects could not be loaded', () => {
  const failed = (data) => ({ data, isLoading: false, isError: true, isFetching: false, refetch: vi.fn() });

  it('says so, and never claims there are no projects', () => {
    hooks.useAdminProjects.mockReturnValue(failed(undefined));
    render(<AdminProjectsPanel />);
    expect(screen.getByRole('alert')).toHaveTextContent('COULDN’T LOAD YOUR PROJECTS');
    expect(screen.queryByText(/No projects yet/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'All projects', exact: true })).toBeInTheDocument();
  });

  it('keeps showing the list when only a background refetch failed', () => {
    hooks.useAdminProjects.mockReturnValue(failed([LIVE, DRAFT]));
    render(<AdminProjectsPanel />);
    expect(screen.getByRole('button', { name: `Edit ${LIVE.title}` })).toBeInTheDocument();
    expect(screen.queryByText(/COULDN.T LOAD/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'All projects (2)', exact: true })).toBeInTheDocument();
  });

  it('shows no count while loading', () => {
    hooks.useAdminProjects.mockReturnValue({ data: undefined, isLoading: true });
    render(<AdminProjectsPanel />);
    expect(screen.getByRole('heading', { name: 'All projects', exact: true })).toBeInTheDocument();
  });
});

// ── PF-118 batch 2 — the unsaved-changes guard, through the real panel ──────
describe('leaving unsaved work asks first (PF-118 batch 2)', () => {
  const dialogBtn = (name) => within(screen.getByRole('dialog')).getByRole('button', { name });

  it('a half-typed NEW project: switching records asks, and SAVE makes it a DRAFT', async () => {
    const user = userEvent.setup();
    renderWithGuard(<AdminProjectsPanel />);

    await user.type(field('Title'), 'Unfinished idea');
    await user.click(editRow('ClearDrive'));

    expect(screen.getByRole('dialog')).toHaveTextContent('Your new project has changes that are not saved yet.');
    await user.click(dialogBtn('SAVE AS DRAFT'));

    await waitFor(() => expect(hooks.create.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Unfinished idea', published: false }),
    ));
    // …and THEN the record that was clicked opens.
    await waitFor(() => expect(field('Title')).toHaveValue('ClearDrive'));
  });

  it('editing a LIVE project: CANCEL EDIT asks; KEEP EDITING keeps the typing', async () => {
    const user = userEvent.setup();
    renderWithGuard(<AdminProjectsPanel />);

    await user.click(editRow('ClearDrive'));
    await user.type(field('Title'), ' v2');
    await user.click(btn('CANCEL EDIT'));

    expect(screen.getByRole('dialog')).toHaveTextContent('“ClearDrive” has changes');
    expect(dialogBtn('SAVE CHANGES')).toBeInTheDocument();
    await user.click(dialogBtn('KEEP EDITING'));

    expect(field('Title')).toHaveValue('ClearDrive v2');
    expect(hooks.update.mutateAsync).not.toHaveBeenCalled();
  });

  it('editing a DRAFT offers SAVE DRAFT — a prompt never publishes', async () => {
    const user = userEvent.setup();
    renderWithGuard(<AdminProjectsPanel />);

    await user.click(editRow('Half-written'));
    await user.type(field('Title'), '!');
    await user.click(btn('CANCEL EDIT'));
    await user.click(dialogBtn('SAVE DRAFT'));

    await waitFor(() => expect(hooks.update.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p2', data: expect.objectContaining({ published: false }) }),
    ));
  });

  it('DISCARD & LEAVE drops the typing and opens the clicked record', async () => {
    const user = userEvent.setup();
    renderWithGuard(<AdminProjectsPanel />);

    await user.type(field('Title'), 'Throwaway');
    await user.click(editRow('ClearDrive'));
    await user.click(dialogBtn('DISCARD & LEAVE'));

    expect(field('Title')).toHaveValue('ClearDrive');
    expect(hooks.create.mutateAsync).not.toHaveBeenCalled();
  });

  it('nothing typed: records switch freely — the zero case', async () => {
    const user = userEvent.setup();
    renderWithGuard(<AdminProjectsPanel />);
    await user.click(editRow('ClearDrive'));
    await user.click(editRow('Half-written'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(field('Title')).toHaveValue('Half-written');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The row's PUBLISH / UNPUBLISH (owner, 2026-10-14) — Blog's row toggle.
describe('the row PUBLISH / UNPUBLISH', () => {
  const COMPLETE_DRAFT = Object.freeze({ ...LIVE, _id: 'p3', title: 'Ready draft', featured: false, published: false });
  const rowBtn = (name) => screen.getByRole('button', { name });

  it('labels each row by its state', () => {
    render(<AdminProjectsPanel />);
    expect(rowBtn('Unpublish ClearDrive')).toHaveTextContent('UNPUBLISH');
    expect(rowBtn('Publish Half-written')).toHaveTextContent(/^PUBLISH$/);
  });

  it('UNPUBLISH sends only published:false, at once', async () => {
    const user = userEvent.setup();
    render(<AdminProjectsPanel />);

    await user.click(rowBtn('Unpublish ClearDrive'));

    expect(hooks.update.mutateAsync).toHaveBeenCalledWith({ id: 'p1', data: { published: false } });
    expect(hooks.showFlash).toHaveBeenCalledWith('Project unpublished');
  });

  it('a COMPLETE draft publishes straight from the row', async () => {
    hooks.useAdminProjects.mockReturnValue({ data: [LIVE, COMPLETE_DRAFT], isLoading: false });
    const user = userEvent.setup();
    render(<AdminProjectsPanel />);

    await user.click(rowBtn('Publish Ready draft'));

    expect(hooks.update.mutateAsync).toHaveBeenCalledWith({ id: 'p3', data: { published: true } });
    expect(hooks.showFlash).toHaveBeenCalledWith('Project published');
  });

  it('an INCOMPLETE draft sends nothing — it opens with the missing fields marked', async () => {
    const user = userEvent.setup();
    render(<AdminProjectsPanel />);

    await user.click(rowBtn('Publish Half-written'));

    expect(hooks.update.mutateAsync).not.toHaveBeenCalled();
    expect(field('Title')).toHaveValue('Half-written');
    expect(field('GitHub URL')).toHaveAttribute('aria-invalid', 'true');
    expect(field(SUMMARY)).toHaveAttribute('aria-invalid', 'true');
    expect(field('Title')).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('a refused toggle is said, not swallowed', async () => {
    hooks.update.mutateAsync = vi.fn().mockRejectedValue(httpError(400, 'GitHub URL is required'));
    const user = userEvent.setup();
    render(<AdminProjectsPanel />);

    await user.click(rowBtn('Unpublish ClearDrive'));

    expect(await screen.findByText(/Unpublish: GitHub URL is required/)).toBeInTheDocument();
    expect(hooks.showFlash).not.toHaveBeenCalled();
  });
});

// ── PF-144 part 2 — pictures inside a section ──────────────────────────────
describe('section pictures', () => {
  const png = (name) => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], name, { type: 'image/png' });
  const pictureInput = (section) => formCard().querySelector(`#project-section-${section}-picture`);

  it('a pick is STAGED: previewed, PENDING SAVE, nothing uploaded, the form dirty', async () => {
    const user = userEvent.setup();
    render(<AdminProjectsPanel />);
    await user.click(editRow('ClearDrive'));
    await user.upload(pictureInput(0), png('dash.png'));

    expect(within(formCard()).getByText('PENDING SAVE')).toBeInTheDocument();
    expect(hooks.uploadPic.mutateAsync).not.toHaveBeenCalled();
    expect(btn('SAVE CHANGES')).toBeEnabled();
  });

  it('SAVE uploads the picture FIRST, then ONE save names it with its caption', async () => {
    const user = userEvent.setup();
    const order = [];
    hooks.uploadPic.mutateAsync = vi.fn(async ({ id }) => { order.push(`upload:${id}`);
      return { publicId: 'p/dash', url: 'https://res.cloudinary.com/x/dash.png', width: 1920, height: 1080 }; });
    hooks.update.mutateAsync = vi.fn(async () => { order.push('update'); });
    render(<AdminProjectsPanel />);
    await user.click(editRow('ClearDrive'));
    await user.upload(pictureInput(0), png('dash.png'));
    await user.type(field('Section 01, picture 1 caption'), 'Dashboard');
    await user.click(btn('SAVE CHANGES'));

    await waitFor(() => expect(hooks.showFlash).toHaveBeenCalledWith('Project updated'));
    expect(order).toEqual(['upload:p1', 'update']);
    expect(hooks.update.mutateAsync.mock.calls[0][0].data.sections[0].images)
      .toEqual([{ publicId: 'p/dash', caption: 'Dashboard' }]);
  });

  it('a NEW project with a picture: created as a DRAFT, picture uploaded, THEN published', async () => {
    const user = userEvent.setup();
    render(<AdminProjectsPanel />);
    await fillComplete(user);
    await user.upload(pictureInput(0), png('shot.png'));
    await user.click(btn('ADD PROJECT'));

    await waitFor(() => expect(hooks.update.mutateAsync).toHaveBeenCalled());
    expect(hooks.create.mutateAsync.mock.calls[0][0].published).toBe(false);
    expect(hooks.uploadPic.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ id: 'new1' }));
    const final = hooks.update.mutateAsync.mock.calls[0][0];
    expect(final).toMatchObject({ id: 'new1', data: { published: true } });
    expect(final.data.sections[0].images).toEqual([{ publicId: 'p/shot.png', caption: '' }]);
  });

  it('a failed upload: nothing published, the owner stays on it, the picture still staged', async () => {
    const user = userEvent.setup();
    hooks.uploadPic.mutateAsync = vi.fn().mockRejectedValue(httpError(503, "Pictures can't be uploaded right now. Please try again later."));
    render(<AdminProjectsPanel />);
    await user.click(editRow('ClearDrive'));
    await user.upload(pictureInput(0), png('dash.png'));
    await user.click(btn('SAVE CHANGES'));

    expect(await screen.findByText(/Picture: Pictures can't be uploaded right now/)).toBeInTheDocument();
    expect(hooks.update.mutateAsync).not.toHaveBeenCalled();
    expect(within(formCard()).getByText('PENDING SAVE')).toBeInTheDocument();
  });

  it('× removes a picture from the form; REVERT brings a saved one back', async () => {
    const withPic = { ...LIVE, sections: [{ heading: 'Description', body: ['x'], bullets: [],
      images: [{ publicId: 'p/a', url: 'https://res.cloudinary.com/x/a.png', width: 1, height: 1, caption: 'A' }] }] };
    hooks.useAdminProjects.mockReturnValue({ data: [withPic, DRAFT], isLoading: false });
    const user = userEvent.setup();
    render(<AdminProjectsPanel />);
    await user.click(editRow('ClearDrive'));
    expect(field('Section 01, picture 1 caption')).toHaveValue('A');

    await user.click(within(formCard()).getByRole('button', { name: 'Remove picture 1 from section 01' }));
    expect(within(formCard()).queryByLabelText('Section 01, picture 1 caption')).toBeNull();
    await user.click(btn('REVERT CHANGES'));
    expect(field('Section 01, picture 1 caption')).toHaveValue('A');
  });

  // ── PF-138: reordering, staged like everything else ──
  describe('reordering', () => {
    const pic = (id, caption) => ({ publicId: `p/${id}`, url: `https://res.cloudinary.com/x/${id}.png`, width: 1, height: 1, caption });
    const withPics = { ...LIVE, sections: [{ heading: 'Description', body: ['x'], bullets: [],
      images: [pic('a', 'A'), pic('b', 'B'), pic('c', 'C')] }] };
    const captions = () => [1, 2, 3].map((n) => field(`Section 01, picture ${n} caption`).value);
    const moveBtn = (n, way) =>
      within(formCard()).getByRole('button', { name: `Move picture ${n} of section 01 ${way}` });
    const items = () => within(formCard()).getAllByLabelText(/^Section 01, picture \d caption$/)
      .map((input) => input.closest('li'));

    beforeEach(() => {
      hooks.useAdminProjects.mockReturnValue({ data: [withPics, DRAFT], isLoading: false });
    });
    // ⚠️ jsdom has no DragEvent: without this testing-library drops clientX
    // and every drop reads as "before" (AdminSkillsPanel.test.jsx found it).
    beforeAll(() => {
      if (!window.DragEvent) window.DragEvent = class DragEvent extends MouseEvent {};
    });
    const dragOnto = (from, onto, clientX) => {
      const data = { effectAllowed: '', dropEffect: '', types: ['text/plain'], setData: vi.fn(), files: [] };
      fireEvent.dragStart(from, { dataTransfer: data });
      fireEvent.dragOver(onto, { dataTransfer: data, clientX });
      fireEvent.drop(onto, { dataTransfer: data });
    };

    it('← → move a picture, the form turns dirty, SAVE sends the NEW order', async () => {
      const user = userEvent.setup();
      render(<AdminProjectsPanel />);
      await user.click(editRow('ClearDrive'));
      expect(btn('SAVE CHANGES')).toBeDisabled();

      await user.click(moveBtn(3, 'earlier'));
      expect(captions()).toEqual(['A', 'C', 'B']);
      await user.click(moveBtn(1, 'later'));
      expect(captions()).toEqual(['C', 'A', 'B']);
      expect(btn('SAVE CHANGES')).toBeEnabled();

      await user.click(btn('SAVE CHANGES'));
      await waitFor(() => expect(hooks.update.mutateAsync).toHaveBeenCalled());
      expect(hooks.update.mutateAsync.mock.calls[0][0].data.sections[0].images.map((i) => i.publicId))
        .toEqual(['p/c', 'p/a', 'p/b']);
    });

    it('the ends cannot move further: first has no ←, last has no →', async () => {
      const user = userEvent.setup();
      render(<AdminProjectsPanel />);
      await user.click(editRow('ClearDrive'));
      expect(moveBtn(1, 'earlier')).toBeDisabled();
      expect(moveBtn(3, 'later')).toBeDisabled();
      expect(moveBtn(2, 'earlier')).toBeEnabled();
    });

    it('REVERT puts the saved order back', async () => {
      const user = userEvent.setup();
      render(<AdminProjectsPanel />);
      await user.click(editRow('ClearDrive'));
      await user.click(moveBtn(1, 'later'));
      await user.click(btn('REVERT CHANGES'));
      expect(captions()).toEqual(['A', 'B', 'C']);
      expect(btn('SAVE CHANGES')).toBeDisabled();
    });

    it('drag one picture onto another\'s place (mouse), and the drop never stages a file', async () => {
      const user = userEvent.setup();
      render(<AdminProjectsPanel />);
      await user.click(editRow('ClearDrive'));
      const [first, , third] = items();
      // jsdom boxes are 0×0: clientX 1 is the right half (AFTER), -1 the left (BEFORE).
      dragOnto(first, third, 1);
      expect(captions()).toEqual(['B', 'C', 'A']);
      expect(within(formCard()).queryByText('PENDING SAVE')).toBeNull();
      expect(hooks.uploadPic.mutateAsync).not.toHaveBeenCalled();
    });

    it('dropped on the LEFT half of a picture, it lands BEFORE that one', async () => {
      const user = userEvent.setup();
      render(<AdminProjectsPanel />);
      await user.click(editRow('ClearDrive'));
      const [first, , third] = items();
      dragOnto(first, third, -1);
      expect(captions()).toEqual(['B', 'A', 'C']);
      expect(btn('SAVE CHANGES')).toBeEnabled();
    });

    it('one picture alone: nothing to move, no arrows', async () => {
      hooks.useAdminProjects.mockReturnValue({ data: [{ ...withPics, sections: [{ ...withPics.sections[0], images: [pic('a', 'A')] }] }, DRAFT], isLoading: false });
      const user = userEvent.setup();
      render(<AdminProjectsPanel />);
      await user.click(editRow('ClearDrive'));
      expect(within(formCard()).queryByRole('button', { name: /^Move picture/ })).toBeNull();
    });
  });

  it('at most 4: the ADD PICTURE control goes once a section is full', async () => {
    const user = userEvent.setup();
    render(<AdminProjectsPanel />);
    await user.click(editRow('ClearDrive'));
    for (const n of [1, 2, 3, 4]) await user.upload(pictureInput(0), png(`s${n}.png`));
    expect(pictureInput(0)).toBeNull();
    expect(within(formCard()).getAllByText('PENDING SAVE')).toHaveLength(4);
  });
});
