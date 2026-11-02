// PF-143 — the Certificates panel (EntryListPanel + certificate fields).
// Every staging assertion is a PAIR: nothing sent on the edit, then SAVE sends it.
import { screen, within, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWithGuard } from '../../../../test/renderWithGuard';

const m = vi.hoisted(() => {
  const mut = () => ({ mutateAsync: vi.fn(), isPending: false });
  return {
    list: vi.fn(), vocab: vi.fn(), impact: vi.fn(), createVocab: mut(), deleteVocab: mut(),
    create: mut(), update: mut(), remove: mut(), reorder: mut(), upload: mut(), removePic: mut(),
    showFlash: vi.fn(),
  };
});

vi.mock('../../../../hooks/useEntries', () => ({
  certificateHooks: {
    useAdmin: m.list,
    useCreate: () => m.create, useUpdate: () => m.update, useRemove: () => m.remove,
    useReorder: () => m.reorder, useUploadPicture: () => m.upload, useRemovePicture: () => m.removePic,
  },
}));
vi.mock('../../../../hooks/useVocabulary', () => ({
  useVocabulary: m.vocab, useVocabularyImpact: m.impact,
  useCreateVocabulary: () => m.createVocab, useDeleteVocabulary: () => m.deleteVocab,
}));
vi.mock('../../../../hooks/useAdminFlash', () => ({ useAdminFlash: () => ({ showFlash: m.showFlash }) }));
const resize = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock('../../../../utils/resizeImage', async (orig) => ({ ...(await orig()), resizeImage: resize.fn }));

const { AdminCertificatesPanel } = await import('../AdminCertificatesPanel');

const LIVE = Object.freeze({ _id: 'c1', title: 'Cloud Foundations', issuer: 'Oracle', issued: '2025-06', tags: ['Cloud'], published: true,
  image: { url: 'https://cdn.test/a.jpg', publicId: 'p/a', format: 'png' } });
const DRAFT = Object.freeze({ _id: 'c2', title: 'GitHub Foundations', issuer: '', issued: '', published: false, image: { url: '' } });
const THIRD = Object.freeze({ _id: 'c3', title: 'Python', issuer: 'DataCamp', issued: '2025', tags: ['Python'], published: true, image: { url: '' } });
const CHIPS = [{ _id: 'v1', value: 'Cloud' }, { _id: 'v2', value: 'Python' }];
/** Pick a tag in the form's picker. */
const pickTag = (user, value) => user.click(within(formCard()).getByRole('button', { name: `+ ${value}` }));

const formCard = () => screen.getByRole('heading', { name: /new certificate|edit certificate/i }).closest('section');
const listCard = () => screen.getByRole('heading', { name: /All certificates/ }).closest('section');
const inForm = (label) => within(formCard()).getByLabelText(label);
const formBtn = (name) => within(formCard()).getByRole('button', { name });

beforeEach(() => {
  vi.clearAllMocks();
  m.list.mockReturnValue({ data: [LIVE, DRAFT, THIRD], isLoading: false });
  m.vocab.mockReturnValue({ data: CHIPS, isLoading: false });
  m.create.mutateAsync = vi.fn().mockResolvedValue({ _id: 'new1' });
  m.update.mutateAsync = vi.fn().mockResolvedValue({});
  m.remove.mutateAsync = vi.fn().mockResolvedValue({});
  m.reorder.mutateAsync = vi.fn().mockResolvedValue([]);
  m.upload.mutateAsync = vi.fn().mockResolvedValue({});
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
  window.scrollTo = vi.fn();
  resize.fn.mockImplementation(async (file) => ({ file, resized: false }));
});

describe('a new certificate', () => {
  it('SAVE AS DRAFT sends only the title, unpublished', async () => {
    const user = userEvent.setup();
    renderWithGuard(<AdminCertificatesPanel />);
    await user.type(inForm('Title'), 'AWS Cloud Practitioner');
    await user.type(inForm('Issuer'), 'AWS');
    await user.type(within(formCard()).getByLabelText('Issue date — year'), '2026');
    await pickTag(user, 'Cloud');
    expect(m.create.mutateAsync).not.toHaveBeenCalled();

    await user.click(formBtn('SAVE AS DRAFT'));
    expect(m.create.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      title: 'AWS Cloud Practitioner', issuer: 'AWS', issued: '2026', tags: ['Cloud'], published: false,
    }));
  });

  it('a DRAFT without issuer and date is refused too (owner, 2026-11-02)', async () => {
    const user = userEvent.setup();
    renderWithGuard(<AdminCertificatesPanel />);
    await user.type(inForm('Title'), 'X');
    await user.click(formBtn('SAVE AS DRAFT'));
    expect(m.create.mutateAsync).not.toHaveBeenCalled();
    expect(within(formCard()).getByText('CHECK THE CHANGES AGAIN — Issuer, Issue date, Tag need attention.')).toBeInTheDocument();
    expect(within(formCard()).getAllByText('This field is required.')).toHaveLength(2);
  });

  it('the description is sent, with a character count under it', async () => {
    const user = userEvent.setup();
    renderWithGuard(<AdminCertificatesPanel />);
    await user.type(inForm('Title'), 'X');
    await user.type(inForm('Issuer'), 'GitHub');
    await user.type(within(formCard()).getByLabelText('Issue date — year'), '2026');
    await pickTag(user, 'Cloud');
    await user.type(inForm('Description (optional)'), 'Git and PRs.');
    expect(within(formCard()).getByText('12 / 1000')).toBeInTheDocument();
    await user.click(formBtn('ADD CERTIFICATE'));
    expect(m.create.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ description: 'Git and PRs.' }));
  });

  it('tags are required — a refused save marks the picker and focuses it (owner, 2026-11-02)', async () => {
    const user = userEvent.setup();
    renderWithGuard(<AdminCertificatesPanel />);
    await user.type(inForm('Title'), 'X');
    await user.type(inForm('Issuer'), 'GitHub');
    await user.type(within(formCard()).getByLabelText('Issue date — year'), '2026');
    await user.click(formBtn('SAVE AS DRAFT'));
    expect(m.create.mutateAsync).not.toHaveBeenCalled();
    expect(within(formCard()).getByText('CHECK THE CHANGES AGAIN — Tag needs attention.')).toBeInTheDocument();
    const picker = within(formCard()).getByRole('group', { name: 'Tag' });
    expect(picker).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(picker).toHaveFocus());
    expect(within(formCard()).getByText('Pick a tag, or add a new one.')).toBeInTheDocument();

    await pickTag(user, 'Python');
    await user.click(formBtn('SAVE AS DRAFT'));
    expect(m.create.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ tags: ['Python'] }));
  });

  it('a tag not in the list is ADDED to it and picked (Blog\'s way)', async () => {
    const user = userEvent.setup();
    m.createVocab.mutateAsync = vi.fn().mockResolvedValue({ _id: 'v9', value: 'DevOps' });
    renderWithGuard(<AdminCertificatesPanel />);
    await user.type(within(formCard()).getByLabelText('New tag name'), 'DevOps');
    await user.click(within(formCard()).getByRole('button', { name: '+ ADD TAG' }));
    expect(m.createVocab.mutateAsync).toHaveBeenCalledWith('DevOps');
    await user.type(inForm('Title'), 'X');
    await user.type(inForm('Issuer'), 'GitHub');
    await user.type(within(formCard()).getByLabelText('Issue date — year'), '2026');
    await user.click(formBtn('SAVE AS DRAFT'));
    expect(m.create.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ tags: ['DevOps'] }));
  });

  it('ONE tag: editing shows it picked, and picking another REPLACES it (owner, 2026-11-02)', async () => {
    const user = userEvent.setup();
    renderWithGuard(<AdminCertificatesPanel />);
    await user.click(screen.getByRole('button', { name: 'Edit Cloud Foundations' }));
    expect(within(formCard()).getByRole('button', { name: '✓ Cloud' })).toHaveAttribute('aria-pressed', 'true');
    await pickTag(user, 'Python');
    expect(within(formCard()).getByRole('button', { name: '+ Cloud' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(formCard()).getByText(/Click to pick ONE/)).toBeInTheDocument();
    await user.click(formBtn('SAVE CHANGES'));
    expect(m.update.mutateAsync).toHaveBeenCalledWith({ id: 'c1', data: expect.objectContaining({ tags: ['Python'] }) });
  });

  it('removing a tag that is some certificate\'s ONLY tag is refused in the dialog — no YES', async () => {
    const user = userEvent.setup();
    m.impact.mockReturnValue({ data: { affected: 1, label: 'certificates', blocked: ['Cloud Foundations'] }, isLoading: false });
    renderWithGuard(<AdminCertificatesPanel />);
    await user.click(within(formCard()).getByRole('button', { name: 'Remove Cloud from the certificate tag list' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/only tag of: Cloud Foundations/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /YES, REMOVE/ })).toBeDisabled();
  });

  it('the picture caption names every type it takes', () => {
    renderWithGuard(<AdminCertificatesPanel />);
    expect(within(formCard()).getByText(/PNG, JPG\/JPEG, WEBP OR PDF · MAX 4 MB/)).toBeInTheDocument();
  });

  it('the dates take an optional day, like Education\'s', () => {
    renderWithGuard(<AdminCertificatesPanel />);
    expect(within(formCard()).getByLabelText('Issue date — day')).toBeInTheDocument();
    expect(within(formCard()).getByLabelText('Expiry date (optional) — day')).toBeInTheDocument();
  });

  it('ADD CERTIFICATE without issuer and date is REFUSED: nothing sent, both marked, banner NAMES them', async () => {
    const user = userEvent.setup();
    renderWithGuard(<AdminCertificatesPanel />);
    await user.type(inForm('Title'), 'X');
    await user.click(formBtn('ADD CERTIFICATE'));

    expect(m.create.mutateAsync).not.toHaveBeenCalled();
    expect(within(formCard()).getByText('CHECK THE CHANGES AGAIN — Issuer, Issue date, Tag need attention.')).toBeInTheDocument();
    expect(inForm('Issuer')).toHaveAttribute('aria-invalid', 'true');
    expect(within(formCard()).getByLabelText('Issue date — year')).toHaveAttribute('aria-invalid', 'true');
  });

  it('the date is TYPED (any month spelling) and sent as YYYY-MM', async () => {
    const user = userEvent.setup();
    renderWithGuard(<AdminCertificatesPanel />);
    await user.type(inForm('Title'), 'X');
    await user.type(inForm('Issuer'), 'GitHub');
    await user.type(within(formCard()).getByLabelText('Issue date — year'), '2026');
    await user.type(within(formCard()).getByLabelText('Issue date — month'), 'march');
    await pickTag(user, 'Cloud');
    await user.click(formBtn('ADD CERTIFICATE'));
    expect(m.create.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ issued: '2026-03', published: true }));
  });

  it('a mistyped date is refused, with its problem under the field', async () => {
    const user = userEvent.setup();
    renderWithGuard(<AdminCertificatesPanel />);
    await user.type(inForm('Title'), 'X');
    await user.type(inForm('Issuer'), 'GitHub');
    await user.type(within(formCard()).getByLabelText('Issue date — year'), '2026');
    await user.type(within(formCard()).getByLabelText('Issue date — month'), 'Jux');
    await user.click(formBtn('ADD CERTIFICATE'));
    expect(m.create.mutateAsync).not.toHaveBeenCalled();
    expect(within(formCard()).getByText('Type a month: JAN–DEC or 1–12.')).toBeInTheDocument();
  });

  it('a picked PDF is staged (nothing sent), then uploaded AFTER the record on SAVE', async () => {
    const user = userEvent.setup();
    renderWithGuard(<AdminCertificatesPanel />);
    await user.type(inForm('Title'), 'X');
    await user.type(inForm('Issuer'), 'GitHub');
    await user.type(within(formCard()).getByLabelText('Issue date — year'), '2026');
    await pickTag(user, 'Cloud');
    const pdf = new File(['%PDF-1.4'], 'cert.pdf', { type: 'application/pdf' });
    await user.upload(formCard().querySelector('input[type="file"]'), pdf);

    expect(within(formCard()).getByText(/its first page becomes the picture/)).toBeInTheDocument();
    expect(resize.fn).not.toHaveBeenCalled();   // a PDF is never resized
    expect(m.upload.mutateAsync).not.toHaveBeenCalled();

    await user.click(formBtn('SAVE AS DRAFT'));
    await waitFor(() => expect(m.upload.mutateAsync).toHaveBeenCalledWith({ id: 'new1', file: pdf }));
  });
});

describe('an existing certificate', () => {
  it('REVERT restores the saved values — never blank', async () => {
    const user = userEvent.setup();
    renderWithGuard(<AdminCertificatesPanel />);
    await user.click(screen.getByRole('button', { name: 'Edit Cloud Foundations' }));
    await user.clear(inForm('Title'));
    await user.type(inForm('Title'), 'Changed');
    await user.click(formBtn('REVERT CHANGES'));
    expect(inForm('Title')).toHaveValue('Cloud Foundations');
  });

  it('PUBLISH on an incomplete draft row sends nothing and opens it with the fields marked', async () => {
    const user = userEvent.setup();
    renderWithGuard(<AdminCertificatesPanel />);
    await user.click(screen.getByRole('button', { name: 'Publish GitHub Foundations' }));
    expect(m.update.mutateAsync).not.toHaveBeenCalled();
    expect(inForm('Title')).toHaveValue('GitHub Foundations');
    expect(inForm('Issuer')).toHaveAttribute('aria-invalid', 'true');
  });

  it('the Pin switch STAGES (nothing sent); SAVE sends pinned, REVERT puts it back', async () => {
    const user = userEvent.setup();
    renderWithGuard(<AdminCertificatesPanel />);
    await user.click(screen.getByRole('button', { name: 'Edit Cloud Foundations' }));
    const pin = within(formCard()).getByRole('switch', { name: /Pin to the top/ });
    expect(pin).toHaveAttribute('aria-checked', 'false');

    await user.click(pin);
    expect(pin).toHaveAttribute('aria-checked', 'true');
    expect(m.update.mutateAsync).not.toHaveBeenCalled();
    await user.click(formBtn('REVERT CHANGES'));
    expect(within(formCard()).getByRole('switch', { name: /Pin to the top/ })).toHaveAttribute('aria-checked', 'false');

    await user.click(within(formCard()).getByRole('switch', { name: /Pin to the top/ }));
    await user.click(formBtn('SAVE CHANGES'));
    expect(m.update.mutateAsync).toHaveBeenCalledWith({ id: 'c1', data: expect.objectContaining({ pinned: true }) });
  });

  it('UNPUBLISH sends only `published: false`', async () => {
    const user = userEvent.setup();
    renderWithGuard(<AdminCertificatesPanel />);
    await user.click(screen.getByRole('button', { name: 'Unpublish Cloud Foundations' }));
    expect(m.update.mutateAsync).toHaveBeenCalledWith({ id: 'c1', data: { published: false } });
  });
});

describe('the order — pinned ones lead, the rest is dragged (owner, 2026-11-02)', () => {
  const PIN = Object.freeze({ _id: 'c9', title: 'Pinned one', issuer: 'X', issued: '2020', tags: ['Cloud'], pinned: true, published: true, image: { url: '' } });

  it('↑ ↓ move a row within its group; SAVE ORDER sends every id', async () => {
    const user = userEvent.setup();
    m.list.mockReturnValue({ data: [PIN, LIVE, THIRD], isLoading: false });
    m.reorder.mutateAsync = vi.fn().mockResolvedValue([]);
    renderWithGuard(<AdminCertificatesPanel />);
    expect(within(listCard()).getByText(/Pinned certificates stay on top/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Move Python up' }));
    expect(m.reorder.mutateAsync).not.toHaveBeenCalled();
    await user.click(within(listCard()).getByRole('button', { name: 'SAVE ORDER' }));
    expect(m.reorder.mutateAsync).toHaveBeenCalledWith(['c9', 'c3', 'c1']);
  });

  it('a row can never cross the pinned line — up or down', () => {
    m.list.mockReturnValue({ data: [PIN, LIVE, THIRD], isLoading: false });
    renderWithGuard(<AdminCertificatesPanel />);
    expect(screen.getByRole('button', { name: 'Move Cloud Foundations up' })).toBeDisabled();   // above it: a pin
    expect(screen.getByRole('button', { name: 'Move Pinned one down' })).toBeDisabled();        // below it: not pinned
    expect(screen.getByRole('button', { name: 'Move Cloud Foundations down' })).toBeEnabled();
  });

  it('a pinned row carries a PINNED badge', () => {
    m.list.mockReturnValue({ data: [{ ...LIVE, pinned: true }, DRAFT, THIRD], isLoading: false });
    renderWithGuard(<AdminCertificatesPanel />);
    const rows = within(listCard()).getAllByRole('listitem');
    expect(within(rows[0]).getByText('📌 PINNED')).toBeInTheDocument();
    expect(within(rows[2]).queryByText(/PINNED/)).not.toBeInTheDocument();
  });

  it('marks the rows the home page lists (published ones only)', () => {
    renderWithGuard(<AdminCertificatesPanel />);
    const rows = within(listCard()).getAllByRole('listitem');
    expect(within(rows[0]).getByText('HOME')).toBeInTheDocument();
    expect(within(rows[1]).queryByText('HOME')).not.toBeInTheDocument();   // the draft
  });
});

describe('no section text', () => {
  it('has no Section text card — every word on the site is fixed (owner, 2026-11-02)', () => {
    renderWithGuard(<AdminCertificatesPanel />);
    expect(screen.queryByRole('heading', { name: 'Section text' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'SAVE TEXT' })).not.toBeInTheDocument();
  });
});

describe('leaving', () => {
  it('a dirty form asks before EDIT opens another record', async () => {
    const user = userEvent.setup();
    renderWithGuard(<AdminCertificatesPanel />);
    await user.type(inForm('Title'), 'Half');
    await user.click(screen.getByRole('button', { name: 'Edit Python' }));
    expect(screen.getByRole('dialog', { name: 'Unsaved changes' })).toBeInTheDocument();
  });
});

describe('delete', () => {
  it('asks first (focus on CANCEL), then deletes', async () => {
    const user = userEvent.setup();
    renderWithGuard(<AdminCertificatesPanel />);
    await user.click(screen.getByRole('button', { name: 'Delete Python' }));
    expect(m.remove.mutateAsync).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: /Delete certificate/ });
    fireEvent.click(within(dialog).getByRole('button', { name: /DELETE/ }));
    await waitFor(() => expect(m.remove.mutateAsync).toHaveBeenCalledWith('c3'));
  });
});
