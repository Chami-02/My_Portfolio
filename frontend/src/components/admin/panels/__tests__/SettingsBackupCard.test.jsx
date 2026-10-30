// frontend/src/components/admin/panels/__tests__/SettingsBackupCard.test.jsx
//
// PF-135 — the Settings Backup card: download, restore, safety copies. The
// SERVICE is mocked; the hooks, TanStack Query, the guard, ConfirmDialog and
// the file save are real, with the browser's object-URL calls stubbed (jsdom
// has none).
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  download:           vi.fn(),
  checkRestore:       vi.fn(),
  restore:            vi.fn(),
  listSafetyCopies:   vi.fn(),
  downloadSafetyCopy: vi.fn(),
  showFlash:          vi.fn(),
}));
vi.mock('../../../../services/backupService', () => ({
  backupService: {
    download:           mocks.download,
    checkRestore:       mocks.checkRestore,
    restore:            mocks.restore,
    listSafetyCopies:   mocks.listSafetyCopies,
    downloadSafetyCopy: mocks.downloadSafetyCopy,
  },
}));
vi.mock('../../../../hooks/useAdminFlash', () => ({
  useAdminFlash: () => ({ showFlash: mocks.showFlash }),
}));

const { SettingsBackupCard } = await import('../SettingsBackupCard');

const BACKUP = Object.freeze({
  format: 'portfolio-backup', version: 1, createdAt: '2026-10-30T09:00:00.000Z',
  counts: { projects: 1 }, about: { name: 'Owner' }, projects: [{ title: 'P' }],
});
const COUNTS = Object.freeze({ projects: 4, skills: 26, skillCategories: 6, blog: 4, vocabulary: 32, messages: 140 });
const SUMMARY = Object.freeze({ createdAt: '2026-10-29T08:00:00.000Z', version: 1, hasAbout: true, counts: COUNTS });
const COPY = Object.freeze({ id: 'copy-1', createdAt: '2026-10-30T10:00:00.000Z', counts: COUNTS, reason: 'before-restore' });
const PASSWORD = 'my password';
const serverError = (status, message, extra = {}) =>
  Object.assign(new Error(message), { response: { status, data: { message, ...extra } } });
const jsonFile = (name = 'portfolio-backup-2026-10-29.json', size = 10) =>
  new File(['x'.repeat(size)], name, { type: 'application/json' });

let qc;
const renderCard = () => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><SettingsBackupCard /></QueryClientProvider>);
};
const dialog  = () => screen.getByRole('dialog');
const pwField = () => within(dialog()).getByLabelText('Your password');
const button  = (name) => within(dialog()).getByRole('button', { name });
const fileInput = () => document.querySelector('input[type="file"]');
const toggle = () => screen.getByRole('button', { name: /BACKUP & RESTORE/ });
/** Open the fold, as the owner would. */
const unfold = (user) => user.click(toggle());
const choose = (user, file) => user.upload(fileInput(), file);

let clicked;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.download.mockResolvedValue({ backup: BACKUP, problems: [] });
  mocks.checkRestore.mockResolvedValue(SUMMARY);
  mocks.restore.mockResolvedValue({ backupCreatedAt: SUMMARY.createdAt, counts: COUNTS, messagesAdded: 0 });
  mocks.listSafetyCopies.mockResolvedValue([]);
  mocks.downloadSafetyCopy.mockResolvedValue(BACKUP);
  clicked = [];
  URL.createObjectURL = vi.fn(() => 'blob:backup');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function record() {
    clicked.push({ href: this.href, download: this.download });
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('SettingsBackupCard — the fold (owner, 2026-10-30)', () => {
  it('starts as one line; the toggle opens and closes it, the body inert while folded', async () => {
    const user = userEvent.setup();
    renderCard();
    const body = document.getElementById('settings-backup-body');

    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(toggle()).toHaveAttribute('aria-controls', 'settings-backup-body');
    expect(body).toHaveAttribute('inert');
    await unfold(user);
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(body).not.toHaveAttribute('inert');
    expect(toggle()).toHaveFocus();
    await user.click(toggle());
    expect(body).toHaveAttribute('inert');
  });

  it('the password dialog sits OUTSIDE the fold — never inside an inert part', async () => {
    const user = userEvent.setup();
    renderCard();
    await unfold(user);
    await user.click(screen.getByRole('button', { name: 'DOWNLOAD BACKUP' }));

    expect(document.getElementById('settings-backup-body').contains(dialog())).toBe(false);
  });
});

describe('SettingsBackupCard — download', () => {
  it('says what a backup is, and sends nothing until asked', async () => {
    renderCard();

    expect(screen.getByRole('heading', { name: 'Backup' })).toBeInTheDocument();
    expect(screen.getByText(/never changed by a restore/)).toBeInTheDocument();
    expect(await screen.findByText(/None yet/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mocks.download).not.toHaveBeenCalled();
    expect(mocks.checkRestore).not.toHaveBeenCalled();
  });

  it('asks for the password first, focused; an empty one is refused in place — no request', async () => {
    const user = userEvent.setup();
    renderCard();
    await unfold(user);
    await user.click(screen.getByRole('button', { name: 'DOWNLOAD BACKUP' }));

    expect(dialog()).toHaveTextContent(/messages, names and emails/);
    expect(pwField()).toHaveFocus();
    await user.click(button('DOWNLOAD'));
    expect(pwField()).toHaveAttribute('aria-invalid', 'true');
    expect(within(dialog()).getByText('Enter your password.')).toBeInTheDocument();
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it('downloads the file named for the day, closes and says so', async () => {
    const user = userEvent.setup();
    renderCard();
    await unfold(user);
    await user.click(screen.getByRole('button', { name: 'DOWNLOAD BACKUP' }));
    await user.type(pwField(), `${PASSWORD}{Enter}`);

    await waitFor(() => expect(mocks.showFlash).toHaveBeenCalledWith('Backup downloaded'));
    expect(mocks.download.mock.calls[0][0]).toEqual({ password: PASSWORD });
    expect(clicked).toEqual([{ href: 'blob:backup', download: 'portfolio-backup-2026-10-30.json' }]);
    expect(JSON.parse(await URL.createObjectURL.mock.calls[0][0].text())).toEqual(BACKUP);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('a download that would not restore is still saved — and the card says what to fix', async () => {
    mocks.download.mockResolvedValue({ backup: BACKUP, problems: ['Blog post 3: title — Title is required'] });
    const user = userEvent.setup();
    renderCard();
    await unfold(user);
    await user.click(screen.getByRole('button', { name: 'DOWNLOAD BACKUP' }));
    await user.type(pwField(), `${PASSWORD}{Enter}`);

    const box = await screen.findByRole('alert');
    expect(box).toHaveTextContent(/cannot be restored until these are fixed/);
    expect(box).toHaveTextContent('Blog post 3: title — Title is required');
    expect(clicked).toHaveLength(1);
  });

  it('a wrong password stays in the dialog with the server\'s words — no file', async () => {
    mocks.download.mockRejectedValue(serverError(400, 'Your password is wrong.'));
    const user = userEvent.setup();
    renderCard();
    await unfold(user);
    await user.click(screen.getByRole('button', { name: 'DOWNLOAD BACKUP' }));
    await user.type(pwField(), 'wrong{Enter}');

    expect(await within(dialog()).findByText('Your password is wrong.')).toBeInTheDocument();
    expect(clicked).toEqual([]);
    expect(mocks.showFlash).not.toHaveBeenCalled();
  });

  it('opening again starts empty, hidden, with no old error', async () => {
    mocks.download.mockRejectedValueOnce(serverError(400, 'Your password is wrong.'));
    const user = userEvent.setup();
    renderCard();
    await unfold(user);
    await user.click(screen.getByRole('button', { name: 'DOWNLOAD BACKUP' }));
    await user.type(pwField(), 'wrong{Enter}');
    await within(dialog()).findByText('Your password is wrong.');
    await user.click(button('CANCEL'));
    await user.click(screen.getByRole('button', { name: 'DOWNLOAD BACKUP' }));

    expect(pwField()).toHaveValue('');
    expect(pwField()).toHaveAttribute('type', 'password');
    expect(within(dialog()).queryByText('Your password is wrong.')).not.toBeInTheDocument();
  });
});

describe('SettingsBackupCard — restore', () => {
  it('RESTORE FROM FILE opens the file picker; the input is clipped, not removed', async () => {
    const user = userEvent.setup();
    renderCard();
    await unfold(user);
    const pickerClick = vi.spyOn(fileInput(), 'click');
    await user.click(screen.getByRole('button', { name: 'RESTORE FROM FILE' }));

    expect(pickerClick).toHaveBeenCalledTimes(1);
    expect(fileInput()).toHaveAttribute('accept', '.json,application/json');
    expect(fileInput()).not.toHaveAttribute('hidden');
  });

  it('the picker is emptied after each pick, so the SAME file can be chosen again', async () => {
    mocks.checkRestore.mockRejectedValueOnce(serverError(422, 'x', { problems: ['Blog post 1: title — Title is required'] }));
    const user = userEvent.setup();
    renderCard();
    await unfold(user);
    const file = jsonFile();
    await choose(user, file);
    await screen.findByRole('alert');

    expect(fileInput().value).toBe('');
    await choose(user, file);
    await waitFor(() => expect(mocks.checkRestore).toHaveBeenCalledTimes(2));
  });

  it('a wrong kind of file is refused in the card — no request', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderCard();
    await unfold(user);
    await choose(user, new File(['x'], 'photo.png', { type: 'image/png' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Choose the .json file that DOWNLOAD BACKUP saved.');
    expect(mocks.checkRestore).not.toHaveBeenCalled();
  });

  it('a file over 4 MB is refused in the card — no request', async () => {
    const user = userEvent.setup();
    renderCard();
    await unfold(user);
    await choose(user, jsonFile('big.json', 4 * 1024 * 1024 + 1));

    expect(await screen.findByRole('alert')).toHaveTextContent(/bigger than 4 MB/);
    expect(mocks.checkRestore).not.toHaveBeenCalled();
  });

  it('a file the server refuses lists every reason — no dialog, nothing restored', async () => {
    mocks.checkRestore.mockRejectedValue(serverError(422, 'This backup cannot be restored. Nothing was changed.', {
      problems: ['Blog post 3: title — Title is required', 'Skill 1 (“Git”): category — the section “devops” is not in the file'],
    }));
    const user = userEvent.setup();
    renderCard();
    await unfold(user);
    const file = jsonFile();
    await choose(user, file);

    const box = await screen.findByRole('alert');
    expect(box).toHaveTextContent('This backup cannot be restored. Nothing was changed.');
    expect(within(box).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Blog post 3: title — Title is required',
      'Skill 1 (“Git”): category — the section “devops” is not in the file',
    ]);
    expect(mocks.checkRestore).toHaveBeenCalledWith(file, expect.anything());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mocks.restore).not.toHaveBeenCalled();
  });

  it('a good file shows what is in it, in a red dialog that asks for the password', async () => {
    const user = userEvent.setup();
    renderCard();
    await unfold(user);
    await choose(user, jsonFile());

    await screen.findByRole('dialog');
    expect(dialog()).toHaveTextContent('Replace the site’s content with this backup?');
    expect(dialog()).toHaveTextContent('4 projects · 26 skills · 6 sections · 4 posts · 32 tags & tech · 140 messages');
    expect(dialog()).toHaveTextContent(/Every message you have now is kept/);
    expect(dialog()).toHaveTextContent(/A safety copy of the site as it is now is kept first/);
    expect(pwField()).toHaveFocus();
    expect(mocks.restore).not.toHaveBeenCalled();
  });

  it('restores the SAME file with the password, refetches everything, and says so', async () => {
    const user = userEvent.setup();
    renderCard();
    await unfold(user);
    const file = jsonFile();
    await choose(user, file);
    await screen.findByRole('dialog');
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const cancel = vi.spyOn(qc, 'cancelQueries');
    await user.type(pwField(), PASSWORD);
    await user.click(button('RESTORE'));

    await waitFor(() => expect(mocks.showFlash).toHaveBeenCalledWith(expect.stringMatching(/^Site restored from the backup of 2026\/10\/29 /)));
    expect(mocks.restore.mock.calls[0][0]).toEqual({ file, password: PASSWORD });
    expect(cancel).toHaveBeenCalledWith();
    expect(invalidate).toHaveBeenCalledWith();
    expect(cancel.mock.invocationCallOrder[0]).toBeLessThan(invalidate.mock.invocationCallOrder[0]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('an empty password is refused in place — no restore', async () => {
    const user = userEvent.setup();
    renderCard();
    await unfold(user);
    await choose(user, jsonFile());
    await screen.findByRole('dialog');
    await user.click(button('RESTORE'));

    expect(pwField()).toHaveAttribute('aria-invalid', 'true');
    expect(mocks.restore).not.toHaveBeenCalled();
  });

  it('a wrong password stays in the dialog; nothing is refetched', async () => {
    mocks.restore.mockRejectedValue(serverError(400, 'Your password is wrong.'));
    const user = userEvent.setup();
    renderCard();
    await unfold(user);
    await choose(user, jsonFile());
    await screen.findByRole('dialog');
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    await user.type(pwField(), 'wrong{Enter}');

    expect(await within(dialog()).findByText('Your password is wrong.')).toBeInTheDocument();
    expect(invalidate).not.toHaveBeenCalled();
    expect(mocks.showFlash).not.toHaveBeenCalled();
  });

  it('a file refused on the second check closes the dialog and lists the reasons', async () => {
    mocks.restore.mockRejectedValue(serverError(422, 'This backup cannot be restored. Nothing was changed.', {
      problems: ['The “projects” list should have 2 rows but has 1 — the file is incomplete or edited.'],
    }));
    const user = userEvent.setup();
    renderCard();
    await unfold(user);
    await choose(user, jsonFile());
    await screen.findByRole('dialog');
    await user.type(pwField(), `${PASSWORD}{Enter}`);

    expect(await screen.findByRole('alert')).toHaveTextContent(/“projects” list should have 2 rows/);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('a server that cannot be reached is said plainly in the card', async () => {
    mocks.checkRestore.mockRejectedValue(serverError(503, 'Restore needs a database that supports transactions (a replica set). Nothing was changed.'));
    const user = userEvent.setup();
    renderCard();
    await unfold(user);
    await choose(user, jsonFile());

    expect(await screen.findByRole('alert')).toHaveTextContent(/Nothing was changed/);
  });
});

describe('SettingsBackupCard — safety copies', () => {
  it('lists each copy with its date and counts — and downloads it with the password', async () => {
    mocks.listSafetyCopies.mockResolvedValue([COPY]);
    const user = userEvent.setup();
    renderCard();
    await unfold(user);
    const list = await screen.findByRole('list', { name: 'Safety copies' });
    const [row] = within(list).getAllByRole('listitem');

    expect(row).toHaveTextContent(/^Before a restore · 2026\/10\/30 /);
    expect(row).toHaveTextContent('4 projects · 26 skills · 6 sections · 4 posts · 32 tags & tech · 140 messages');
    await user.click(within(row).getByRole('button', { name: 'DOWNLOAD' }));
    expect(dialog()).toHaveTextContent(/To undo that restore, restore this file/);
    await user.type(pwField(), `${PASSWORD}{Enter}`);

    await waitFor(() => expect(mocks.showFlash).toHaveBeenCalledWith('Safety copy downloaded'));
    expect(mocks.downloadSafetyCopy.mock.calls[0][0]).toEqual({ id: 'copy-1', password: PASSWORD });
    expect(clicked).toEqual([{ href: 'blob:backup', download: 'portfolio-safety-copy-2026-10-30.json' }]);
  });

  it('a list that could not load shows LoadError, never "None yet"', async () => {
    mocks.listSafetyCopies.mockRejectedValue(serverError(500, 'boom'));
    renderCard();

    expect(await screen.findByText('COULDN’T LOAD SAFETY COPIES')).toBeInTheDocument();
    expect(screen.queryByText(/None yet/)).not.toBeInTheDocument();
  });
});
