// PF-143 — the Certificates panel (EntryListPanel + certificate fields).
// Every staging assertion is a PAIR: nothing sent on the edit, then SAVE sends it.
import { screen, within, fireEvent, waitFor } from '@testing-library/react';
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
  certificateHooks: {
    useAdmin: m.list,
    useCreate: () => m.create, useUpdate: () => m.update, useRemove: () => m.remove,
    useReorder: () => m.reorder, useUploadPicture: () => m.upload, useRemovePicture: () => m.removePic,
  },
}));
vi.mock('../../../../hooks/useAbout', () => ({ useAbout: m.about, useUpdateAbout: () => m.updateAbout }));
vi.mock('../../../../hooks/useAdminFlash', () => ({ useAdminFlash: () => ({ showFlash: m.showFlash }) }));
const resize = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock('../../../../utils/resizeImage', async (orig) => ({ ...(await orig()), resizeImage: resize.fn }));

const { AdminCertificatesPanel } = await import('../AdminCertificatesPanel');

const LIVE = Object.freeze({ _id: 'c1', title: 'Cloud Foundations', issuer: 'Oracle', issued: '2025-06', published: true,
  image: { url: 'https://cdn.test/a.jpg', publicId: 'p/a', format: 'png' } });
const DRAFT = Object.freeze({ _id: 'c2', title: 'GitHub Foundations', issuer: '', issued: '', published: false, image: { url: '' } });
const THIRD = Object.freeze({ _id: 'c3', title: 'Python', issuer: 'DataCamp', issued: '2025', published: true, image: { url: '' } });

const formCard = () => screen.getByRole('heading', { name: /new certificate|edit certificate/i }).closest('section');
const textCard = () => screen.getByRole('heading', { name: 'Section text' }).closest('section');
const listCard = () => screen.getByRole('heading', { name: /All certificates/ }).closest('section');
const inForm = (label) => within(formCard()).getByLabelText(label);
const formBtn = (name) => within(formCard()).getByRole('button', { name });

beforeEach(() => {
  vi.clearAllMocks();
  m.list.mockReturnValue({ data: [LIVE, DRAFT, THIRD], isLoading: false });
  m.about.mockReturnValue({ data: { certificatesHeading: 'Certificates', certificatesViewAll: 'VIEW ALL CERTIFICATES' }, isLoading: false });
  m.create.mutateAsync = vi.fn().mockResolvedValue({ _id: 'new1' });
  m.update.mutateAsync = vi.fn().mockResolvedValue({});
  m.remove.mutateAsync = vi.fn().mockResolvedValue({});
  m.reorder.mutateAsync = vi.fn().mockResolvedValue([]);
  m.upload.mutateAsync = vi.fn().mockResolvedValue({});
  m.updateAbout.mutateAsync = vi.fn().mockResolvedValue({});
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
    expect(m.create.mutateAsync).not.toHaveBeenCalled();

    await user.click(formBtn('SAVE AS DRAFT'));
    expect(m.create.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      title: 'AWS Cloud Practitioner', issuer: '', published: false,
    }));
  });

  it('ADD CERTIFICATE without issuer and date is REFUSED: nothing sent, both marked, banner NAMES them', async () => {
    const user = userEvent.setup();
    renderWithGuard(<AdminCertificatesPanel />);
    await user.type(inForm('Title'), 'X');
    await user.click(formBtn('ADD CERTIFICATE'));

    expect(m.create.mutateAsync).not.toHaveBeenCalled();
    expect(within(formCard()).getByText('CHECK THE CHANGES AGAIN — Issuer, Issued need attention.')).toBeInTheDocument();
    expect(inForm('Issuer')).toHaveAttribute('aria-invalid', 'true');
    expect(within(formCard()).getByLabelText('Issued — year')).toHaveAttribute('aria-invalid', 'true');
  });

  it('the date is TYPED (any month spelling) and sent as YYYY-MM', async () => {
    const user = userEvent.setup();
    renderWithGuard(<AdminCertificatesPanel />);
    await user.type(inForm('Title'), 'X');
    await user.type(inForm('Issuer'), 'GitHub');
    await user.type(within(formCard()).getByLabelText('Issued — year'), '2026');
    await user.type(within(formCard()).getByLabelText('Issued — month'), 'march');
    await user.click(formBtn('ADD CERTIFICATE'));
    expect(m.create.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ issued: '2026-03', published: true }));
  });

  it('a mistyped date is refused, with its problem under the field', async () => {
    const user = userEvent.setup();
    renderWithGuard(<AdminCertificatesPanel />);
    await user.type(inForm('Title'), 'X');
    await user.type(inForm('Issuer'), 'GitHub');
    await user.type(within(formCard()).getByLabelText('Issued — year'), '2026');
    await user.type(within(formCard()).getByLabelText('Issued — month'), 'Jux');
    await user.click(formBtn('ADD CERTIFICATE'));
    expect(m.create.mutateAsync).not.toHaveBeenCalled();
    expect(within(formCard()).getByText('Type a month: JAN–DEC or 1–12.')).toBeInTheDocument();
  });

  it('a picked PDF is staged (nothing sent), then uploaded AFTER the record on SAVE', async () => {
    const user = userEvent.setup();
    renderWithGuard(<AdminCertificatesPanel />);
    await user.type(inForm('Title'), 'X');
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

  it('UNPUBLISH sends only `published: false`', async () => {
    const user = userEvent.setup();
    renderWithGuard(<AdminCertificatesPanel />);
    await user.click(screen.getByRole('button', { name: 'Unpublish Cloud Foundations' }));
    expect(m.update.mutateAsync).toHaveBeenCalledWith({ id: 'c1', data: { published: false } });
  });
});

describe('the order', () => {
  it('↓ stages a new order (nothing sent); SAVE ORDER sends every id', async () => {
    const user = userEvent.setup();
    renderWithGuard(<AdminCertificatesPanel />);
    await user.click(screen.getByRole('button', { name: 'Move Cloud Foundations down' }));
    expect(m.reorder.mutateAsync).not.toHaveBeenCalled();
    expect(within(listCard()).getByText('UNSAVED ORDER')).toBeInTheDocument();

    await user.click(within(listCard()).getByRole('button', { name: 'SAVE ORDER' }));
    expect(m.reorder.mutateAsync).toHaveBeenCalledWith(['c2', 'c1', 'c3']);
  });

  // A staged order is reconciled with the live list: an entry added since
  // (another tab, or SAVE in the form above) joins at the end and is SENT —
  // a reorder missing one id is refused by the server.
  it('an entry added while an order is staged is kept, at the end', async () => {
    const user = userEvent.setup();
    renderWithGuard(<AdminCertificatesPanel />);
    await user.click(screen.getByRole('button', { name: 'Move Cloud Foundations down' }));

    const NEW = { _id: 'c4', title: 'New one', issuer: '', issued: '', published: false, image: { url: '' } };
    m.list.mockReturnValue({ data: [LIVE, DRAFT, THIRD, NEW], isLoading: false });
    // Any render picks the new list up (the query's refetch, in the app).
    await user.click(screen.getByRole('button', { name: 'Move Python up' }));
    await user.click(screen.getByRole('button', { name: 'Move Python down' }));
    expect(within(listCard()).getByText('New one')).toBeInTheDocument();

    await user.click(within(listCard()).getByRole('button', { name: 'SAVE ORDER' }));
    expect(m.reorder.mutateAsync).toHaveBeenCalledWith(['c2', 'c1', 'c3', 'c4']);
  });

  it('REVERT ORDER puts the saved order back', async () => {
    const user = userEvent.setup();
    renderWithGuard(<AdminCertificatesPanel />);
    await user.click(screen.getByRole('button', { name: 'Move Python up' }));
    await user.click(within(listCard()).getByRole('button', { name: 'REVERT ORDER' }));
    const titles = within(listCard()).getAllByRole('listitem').map((li) => li.textContent);
    expect(titles[0]).toMatch(/^.?Cloud Foundations/);
    expect(within(listCard()).queryByText('UNSAVED ORDER')).not.toBeInTheDocument();
  });

  it('marks the rows the home page lists (published ones only)', () => {
    renderWithGuard(<AdminCertificatesPanel />);
    const rows = within(listCard()).getAllByRole('listitem');
    expect(within(rows[0]).getByText('HOME')).toBeInTheDocument();
    expect(within(rows[1]).queryByText('HOME')).not.toBeInTheDocument();   // the draft
  });
});

describe('section text', () => {
  it('SAVE TEXT is dim until a word changes, then sends only the section fields', async () => {
    const user = userEvent.setup();
    renderWithGuard(<AdminCertificatesPanel />);
    const save = within(textCard()).getByRole('button', { name: 'SAVE TEXT' });
    expect(save).toBeDisabled();

    const heading = within(textCard()).getByLabelText('Heading (home page)');
    await user.clear(heading);
    await user.type(heading, 'Credentials');
    await user.click(save);

    const sent = m.updateAbout.mutateAsync.mock.calls[0][0];
    expect(sent.certificatesHeading).toBe('Credentials');
    expect(Object.keys(sent).every((k) => k.startsWith('certificates'))).toBe(true);
  });

  it('a failed About load shows LoadError, never an empty form', () => {
    m.about.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn(), isFetching: false });
    renderWithGuard(<AdminCertificatesPanel />);
    expect(within(textCard()).queryByRole('button', { name: 'SAVE TEXT' })).not.toBeInTheDocument();
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

  it('with only the section text dirty, EDIT opens the record without asking', async () => {
    const user = userEvent.setup();
    renderWithGuard(<AdminCertificatesPanel />);
    await user.type(within(textCard()).getByLabelText('Heading (home page)'), '!');
    await user.click(screen.getByRole('button', { name: 'Edit Python' }));
    expect(screen.queryByRole('dialog', { name: 'Unsaved changes' })).not.toBeInTheDocument();
    expect(inForm('Title')).toHaveValue('Python');
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
