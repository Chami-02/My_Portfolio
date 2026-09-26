// frontend/src/components/admin/panels/__tests__/AdminAboutPanel.test.jsx
//
// PF-112 — the rebuilt About panel. Behaviour, not pixels.
//
// ⚠️ THE STAGING ASSERTIONS ARE THE POINT OF THIS FILE, and they are the kind
// that can be vacuous. "Picking a file does not upload it" passes trivially
// against an implementation that uploads immediately IF the mock is never
// inspected closely enough — so every one of them asserts a mutation was NOT
// called AND that pressing SAVE then calls it, which is a pair no
// immediate-upload build can satisfy. Mutation-tested by making the résumé
// upload fire on pick; five cases go red.
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ⚠️ Mocked at the MODULE level rather than with vi.spyOn. Vite's SSR transform
// makes each export a getter-only property that spyOn cannot redefine.
const hooks = vi.hoisted(() => ({
  useAbout:      vi.fn(),
  updateAbout:   { mutateAsync: vi.fn(), isPending: false },
  uploadAvatar:  { mutateAsync: vi.fn(), isPending: false },
  removeAvatar:  { mutateAsync: vi.fn(), isPending: false },
  uploadResume:  { mutateAsync: vi.fn(), isPending: false },
  removeResume:  { mutateAsync: vi.fn(), isPending: false },
  showFlash:     vi.fn(),
}));

vi.mock('../../../../hooks/useAbout', () => ({
  useAbout:         hooks.useAbout,
  useUpdateAbout:   () => hooks.updateAbout,
  useUploadAvatar:  () => hooks.uploadAvatar,
  useRemoveAvatar:  () => hooks.removeAvatar,
  useUploadResume:  () => hooks.uploadResume,
  useRemoveResume:  () => hooks.removeResume,
}));

vi.mock('../../../../hooks/useAdminFlash', () => ({
  useAdminFlash: () => ({ showFlash: hooks.showFlash }),
}));

const { AdminAboutPanel } = await import('../AdminAboutPanel');

// Values deliberately distinct from each other, so a field wired to the wrong
// source fails rather than coincidentally matching.
const ABOUT = {
  name: 'Parindra Gallage',
  title: 'Full-Stack Developer',
  location: 'Galle, Sri Lanka',
  email: 'pcgallege@gmail.com',
  availabilityNote: 'Open to junior roles',
  availableForWork: true,
  bio: ['First paragraph.', 'Second paragraph.'],
  // ⚠️ Two filled and three blank, deliberately: the × only renders for a filled
  // row, so a fixture with all five populated could not tell the two apart.
  social: {
    github: 'https://github.com/Chami-02', linkedin: 'https://linkedin.com/in/x',
    facebook: '', instagram: '', twitter: '',
  },
  socialExtra: [],
  avatar: {}, resume: {},
  hasAvatar: false, hasResume: false,
};

const WITH_RESUME = {
  ...ABOUT,
  hasResume: true,
  resume: {
    url: 'https://cdn.test/cv.pdf', publicId: 'documents/cv', fileName: 'Parindra-CV.pdf',
    ext: 'pdf', bytes: 248 * 1024, uploadedAt: '2026-09-23T10:00:00.000Z',
  },
};

const WITH_AVATAR = {
  ...ABOUT,
  hasAvatar: true,
  avatar: {
    url: 'https://cdn.test/me.webp', publicId: 'profile/me', fileName: 'me.webp',
    format: 'webp', bytes: 512 * 1024, width: 1200, height: 1600,
    uploadedAt: '2026-09-20T10:00:00.000Z',
  },
};

const pdf  = (name = 'cv.pdf')  => new File([new Uint8Array([37, 80, 68, 70])], name, { type: 'application/pdf' });
const png  = (name = 'me.png')  => new File([new Uint8Array([137, 80, 78, 71])], name, { type: 'image/png' });
const huge = (spec, bytes) => new File([new Uint8Array(bytes)], spec.name, { type: spec.type });

const card = (title) => screen.getByRole('heading', { name: title }).closest('section');
const fileInputIn = (section) => section.querySelector('input[type="file"]');
const save = () => screen.getByRole('button', { name: /SAVE PROFILE/i });

const rejected = (err) => vi.fn().mockRejectedValue(err);
const httpError = (status, message) => ({ response: { status, data: { status: 'fail', message } } });

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(hooks.updateAbout,  { mutateAsync: vi.fn().mockResolvedValue(ABOUT) });
  Object.assign(hooks.uploadAvatar, { mutateAsync: vi.fn().mockResolvedValue({}) });
  Object.assign(hooks.removeAvatar, { mutateAsync: vi.fn().mockResolvedValue({}) });
  Object.assign(hooks.uploadResume, { mutateAsync: vi.fn().mockResolvedValue({}) });
  Object.assign(hooks.removeResume, { mutateAsync: vi.fn().mockResolvedValue({}) });
  hooks.useAbout.mockReturnValue({ data: ABOUT, isLoading: false });
  // jsdom implements neither, and the portrait card previews from an object URL.
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});

describe('prefill', () => {
  it('fills the three basic fields from the document', () => {
    render(<AdminAboutPanel />);

    expect(screen.getByLabelText('Location')).toHaveValue('Galle, Sri Lanka');
    expect(screen.getByLabelText('Contact email')).toHaveValue('pcgallege@gmail.com');
    expect(screen.getByLabelText('Availability note')).toHaveValue('Open to junior roles');
  });

  // ⚠️ Removed in PF-112 because editing them changed nothing: both are hardcoded
  // literals on the public site (hero heading, footer, splash). The fixture still
  // CARRIES them, since the API still returns them — so this asserts the panel
  // ignores them rather than that the data is absent.
  it('offers no Full name or Job title field', () => {
    render(<AdminAboutPanel />);

    expect(screen.queryByLabelText('Full name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Job title')).not.toBeInTheDocument();
  });

  it('renders one textarea per bio paragraph', () => {
    render(<AdminAboutPanel />);

    expect(screen.getByLabelText('Bio paragraph 1')).toHaveValue('First paragraph.');
    expect(screen.getByLabelText('Bio paragraph 2')).toHaveValue('Second paragraph.');
  });

  // ⚠️ FIVE, and no Email. The prototype and DESIGN.md §6.3 both show a sixth.
  it('renders five social fields and no social email', () => {
    render(<AdminAboutPanel />);

    const social = card('Social links');
    expect(within(social).getAllByRole('textbox')).toHaveLength(5);
    expect(within(social).queryByLabelText(/email/i)).not.toBeInTheDocument();
  });

  it('shows a skeleton rather than an empty form while loading', () => {
    hooks.useAbout.mockReturnValue({ data: undefined, isLoading: true });
    render(<AdminAboutPanel />);

    expect(screen.queryByLabelText('Full name')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /SAVE PROFILE/i })).not.toBeInTheDocument();
  });
});

describe('bio paragraphs', () => {
  it('adds a paragraph', async () => {
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.click(screen.getByRole('button', { name: '+ ADD PARAGRAPH' }));

    expect(screen.getByLabelText('Bio paragraph 3')).toHaveValue('');
  });

  it('removes a paragraph', async () => {
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.click(screen.getByRole('button', { name: 'Remove paragraph 1' }));

    expect(screen.getByLabelText('Bio paragraph 1')).toHaveValue('Second paragraph.');
    expect(screen.queryByLabelText('Bio paragraph 2')).not.toBeInTheDocument();
  });

  it('offers no remove control for the last remaining paragraph', () => {
    hooks.useAbout.mockReturnValue({ data: { ...ABOUT, bio: ['Only one.'] }, isLoading: false });
    render(<AdminAboutPanel />);

    expect(screen.queryByRole('button', { name: /Remove paragraph/ })).not.toBeInTheDocument();
  });
});

describe('the availability toggle stages rather than publishing', () => {
  it('flips the label without calling any mutation', async () => {
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    expect(screen.getByText('Open to work')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'TOGGLE' }));

    expect(screen.getByText('Not available')).toBeInTheDocument();
    expect(hooks.updateAbout.mutateAsync).not.toHaveBeenCalled();
  });

  it('sends the flipped value only once SAVE is pressed', async () => {
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.click(screen.getByRole('button', { name: 'TOGGLE' }));
    await user.click(save());

    expect(hooks.updateAbout.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ availableForWork: false })
    );
  });

  it('raises no flash of its own', async () => {
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.click(screen.getByRole('button', { name: 'TOGGLE' }));

    expect(hooks.showFlash).not.toHaveBeenCalled();
  });
});

describe('the portrait stages until SAVE', () => {
  it('uploads nothing when a file is picked', async () => {
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.upload(fileInputIn(card('Portrait')), png());

    expect(hooks.uploadAvatar.mutateAsync).not.toHaveBeenCalled();
    expect(hooks.updateAbout.mutateAsync).not.toHaveBeenCalled();
    expect(within(card('Portrait')).getByText('PENDING SAVE')).toBeInTheDocument();
  });

  it('uploads it on SAVE', async () => {
    const user = userEvent.setup();
    render(<AdminAboutPanel />);
    const file = png();

    await user.upload(fileInputIn(card('Portrait')), file);
    await user.click(save());

    expect(hooks.uploadAvatar.mutateAsync).toHaveBeenCalledWith(file);
  });

  it('stages a removal instead of deleting straight away', async () => {
    hooks.useAbout.mockReturnValue({ data: WITH_AVATAR, isLoading: false });
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.click(within(card('Portrait')).getByRole('button', { name: 'REMOVE' }));

    expect(hooks.removeAvatar.mutateAsync).not.toHaveBeenCalled();
    expect(within(card('Portrait')).getByText('REMOVE ON SAVE')).toBeInTheDocument();
  });

  it('performs the delete on SAVE', async () => {
    hooks.useAbout.mockReturnValue({ data: WITH_AVATAR, isLoading: false });
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.click(within(card('Portrait')).getByRole('button', { name: 'REMOVE' }));
    await user.click(save());

    expect(hooks.removeAvatar.mutateAsync).toHaveBeenCalledTimes(1);
  });

  it('discards a staged pick on UNDO', async () => {
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.upload(fileInputIn(card('Portrait')), png());
    await user.click(within(card('Portrait')).getByRole('button', { name: 'UNDO' }));
    await user.click(save());

    expect(hooks.uploadAvatar.mutateAsync).not.toHaveBeenCalled();
  });

  it('reads LIVE for a stored portrait and MISSING for none', () => {
    hooks.useAbout.mockReturnValue({ data: WITH_AVATAR, isLoading: false });
    const { unmount } = render(<AdminAboutPanel />);
    expect(within(card('Portrait')).getByText('LIVE')).toBeInTheDocument();
    unmount();

    hooks.useAbout.mockReturnValue({ data: ABOUT, isLoading: false });
    render(<AdminAboutPanel />);
    expect(within(card('Portrait')).getByText('MISSING')).toBeInTheDocument();
  });
});

describe('the résumé stages until SAVE', () => {
  it('uploads nothing when a file is picked', async () => {
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.upload(fileInputIn(card('Résumé / CV')), pdf());

    expect(hooks.uploadResume.mutateAsync).not.toHaveBeenCalled();
    expect(hooks.updateAbout.mutateAsync).not.toHaveBeenCalled();
    expect(within(card('Résumé / CV')).getByText('PENDING SAVE')).toBeInTheDocument();
  });

  it('uploads it on SAVE', async () => {
    const user = userEvent.setup();
    render(<AdminAboutPanel />);
    const file = pdf('Parindra-CV.pdf');

    await user.upload(fileInputIn(card('Résumé / CV')), file);
    await user.click(save());

    expect(hooks.uploadResume.mutateAsync).toHaveBeenCalledWith(file);
  });

  it('stages a removal instead of deleting straight away', async () => {
    hooks.useAbout.mockReturnValue({ data: WITH_RESUME, isLoading: false });
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.click(within(card('Résumé / CV')).getByRole('button', { name: 'REMOVE' }));

    expect(hooks.removeResume.mutateAsync).not.toHaveBeenCalled();
    expect(within(card('Résumé / CV')).getByText('REMOVE ON SAVE')).toBeInTheDocument();
  });

  it('shows the stored filename and meta', () => {
    hooks.useAbout.mockReturnValue({ data: WITH_RESUME, isLoading: false });
    render(<AdminAboutPanel />);

    const resume = card('Résumé / CV');
    expect(within(resume).getByText('Parindra-CV.pdf')).toBeInTheDocument();
    // ⚠️ `SEPT`, with a T. en-GB renders September's short form with four
    // letters and every other month with three, so this is the one month where
    // an assertion written from memory fails. It is also a real ragged-column
    // defect on the blog cards that share formatDate — reported, not fixed here,
    // because changing it changes copy on a shipped surface.
    expect(within(resume).getByText(/248 KB · replaced 23 SEPT 2026/)).toBeInTheDocument();
  });

  it('offers PREVIEW only once there is a file', () => {
    render(<AdminAboutPanel />);
    expect(within(card('Résumé / CV')).queryByRole('link', { name: /PREVIEW/ })).not.toBeInTheDocument();
  });
});

describe('SAVE', () => {
  // ⚠️ REWRITTEN in PF-112. This used to press SAVE on an untouched form, which
  // is now impossible — the button is disabled until something changes. So the
  // form is dirtied first, and the "nothing staged" part means no FILE staged.
  it('sends only the profile when no file is staged', async () => {
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.type(screen.getByLabelText('Location'), '!');
    await user.click(save());

    expect(hooks.updateAbout.mutateAsync).toHaveBeenCalledTimes(1);
    expect(hooks.uploadAvatar.mutateAsync).not.toHaveBeenCalled();
    expect(hooks.uploadResume.mutateAsync).not.toHaveBeenCalled();
    expect(hooks.showFlash).toHaveBeenCalledWith('Profile saved');
  });

  // The profile PUT goes first so a storage outage still lets a text edit land.
  it('saves the profile before either upload', async () => {
    const order = [];
    hooks.updateAbout.mutateAsync  = vi.fn(async () => { order.push('profile'); });
    hooks.uploadAvatar.mutateAsync = vi.fn(async () => { order.push('avatar'); });
    hooks.uploadResume.mutateAsync = vi.fn(async () => { order.push('resume'); });
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.upload(fileInputIn(card('Portrait')), png());
    await user.upload(fileInputIn(card('Résumé / CV')), pdf());
    await user.click(save());

    expect(order).toEqual(['profile', 'avatar', 'resume']);
  });

  it('sends the edited fields', async () => {
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.clear(screen.getByLabelText('Location'));
    await user.type(screen.getByLabelText('Location'), 'Colombo, Sri Lanka');
    await user.click(save());

    expect(hooks.updateAbout.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ location: 'Colombo, Sri Lanka' })
    );
  });
});

describe('errors are reported per item, with the server’s own wording', () => {
  it.each([
    [415, 'Résumé must be a PDF.'],
    [413, 'Résumé is 6.1 MB — the limit is 5 MB.'],
  ])('renders the %s message verbatim', async (status, message) => {
    hooks.uploadResume.mutateAsync = rejected(httpError(status, message));
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.upload(fileInputIn(card('Résumé / CV')), pdf());
    await user.click(save());

    expect(screen.getByRole('alert')).toHaveTextContent(message);
  });

  // ⚠️ A 503 is the one the operator cannot act on, so the message says so
  // rather than leaving them retrying a server-side configuration problem.
  it('explains that a 503 is not theirs to fix', async () => {
    hooks.uploadResume.mutateAsync = rejected(
      httpError(503, 'File storage is not configured on this server')
    );
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.upload(fileInputIn(card('Résumé / CV')), pdf());
    await user.click(save());

    expect(screen.getByRole('alert')).toHaveTextContent(/Nothing can be done from this panel/i);
  });

  // ⚠️ A dead backend and a rejected file are different problems. utils/
  // loginError.js exists because that exact conflation shipped once.
  it('distinguishes an unreachable server from a rejected file', async () => {
    hooks.uploadResume.mutateAsync = rejected(new Error('Network Error'));
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.upload(fileInputIn(card('Résumé / CV')), pdf());
    await user.click(save());

    expect(screen.getByRole('alert')).toHaveTextContent(/could not be reached/i);
  });

  // ⚠️ THE DISHONEST-SUCCESS CASE. Flashing "Profile saved" after a refused
  // upload is how an operator comes to believe a file is live when it is not.
  it('does not flash success when an upload failed', async () => {
    hooks.uploadResume.mutateAsync = rejected(httpError(415, 'Résumé must be a PDF.'));
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.upload(fileInputIn(card('Résumé / CV')), pdf());
    await user.click(save());

    expect(hooks.showFlash).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/Profile details saved/i);
  });

  it('keeps the refused file staged so SAVE can be pressed again', async () => {
    hooks.uploadResume.mutateAsync = rejected(httpError(415, 'Résumé must be a PDF.'));
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.upload(fileInputIn(card('Résumé / CV')), pdf());
    await user.click(save());

    expect(within(card('Résumé / CV')).getByText('PENDING SAVE')).toBeInTheDocument();
  });
});

describe('the browser-side pick check', () => {
  // ⚠️ A COURTESY, NOT A GATE — the server's magic-byte check is what decides.
  // The value of it is that the owner is not made to wait until SAVE to find out
  // they picked a .txt.
  it('refuses a wrong type at pick time with no request at all', () => {
    render(<AdminAboutPanel />);

    // ⚠️ fireEvent, NOT user.upload. `userEvent.upload` applies the input's own
    // `accept` filter and silently drops a non-matching file, so the change event
    // never fires and the test would assert against a handler that never ran.
    // `accept` is only a hint in a real browser — the file dialog offers an "all
    // files" escape and a drag-drop ignores it outright — so this path is
    // genuinely reachable and the check behind it is not decorative.
    fireEvent.change(fileInputIn(card('Résumé / CV')), {
      target: { files: [new File(['hello'], 'notes.txt', { type: 'text/plain' })] },
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Résumé must be a PDF.');
    expect(hooks.uploadResume.mutateAsync).not.toHaveBeenCalled();
    expect(within(card('Résumé / CV')).getByText('MISSING')).toBeInTheDocument();
  });

  it('refuses an oversized portrait against the 2 MB handler cap, not multer’s 5', async () => {
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.upload(
      fileInputIn(card('Portrait')),
      huge({ name: 'big.png', type: 'image/png' }, 3 * 1024 * 1024)
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/the limit is 2 MB/);
    expect(hooks.uploadAvatar.mutateAsync).not.toHaveBeenCalled();
  });

  // ⚠️ Found in the recheck pass. The first implementation called
  // `staged.clear()` on a rejected pick, so mis-clicking a second file threw
  // away the good one already chosen — losing work while reporting an error
  // about it. Rejecting means "this file is not accepted", not "start again".
  it('keeps an already-staged file when the next pick is refused', async () => {
    const user = userEvent.setup();
    render(<AdminAboutPanel />);
    const good = pdf('Parindra-CV.pdf');

    await user.upload(fileInputIn(card('Résumé / CV')), good);
    fireEvent.change(fileInputIn(card('Résumé / CV')), {
      target: { files: [new File(['x'], 'wrong.txt', { type: 'text/plain' })] },
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Résumé must be a PDF.');
    expect(within(card('Résumé / CV')).getByText('PENDING SAVE')).toBeInTheDocument();

    await user.click(save());
    expect(hooks.uploadResume.mutateAsync).toHaveBeenCalledWith(good);
  });

  it('accepts a PNG for the portrait and a PDF for the résumé', async () => {
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.upload(fileInputIn(card('Portrait')), png());
    await user.upload(fileInputIn(card('Résumé / CV')), pdf());

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('SAVE is dim until something changes (PF-112)', () => {
  it('is disabled on an untouched form', () => {
    render(<AdminAboutPanel />);
    expect(save()).toBeDisabled();
  });

  it.each([
    ['a text field',      async (u) => u.type(screen.getByLabelText('Location'), '!')],
    ['the toggle',        async (u) => u.click(screen.getByRole('button', { name: 'TOGGLE' }))],
    ['a bio paragraph',   async (u) => u.type(screen.getByLabelText('Bio paragraph 1'), '!')],
    ['a staged portrait', async (u) => u.upload(fileInputIn(card('Portrait')), png())],
  ])('becomes enabled after editing %s', async (_what, act) => {
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    expect(save()).toBeDisabled();
    await act(user);
    expect(save()).toBeEnabled();
  });

  it('shows no REVERT control until there is something to revert', () => {
    render(<AdminAboutPanel />);
    expect(screen.queryByRole('button', { name: /REVERT/i })).not.toBeInTheDocument();
  });
});

describe('REVERT restores the saved state (PF-112)', () => {
  const revert = () => screen.getByRole('button', { name: /REVERT/i });

  // ⚠️ THE POINT OF THE REQUEST. The only other cancel in this admin —
  // AdminProjectsPanel's `cancelEdit` — sets the form to EMPTY, so mis-clicking
  // it while editing loses the record's content. This restores, it does not wipe:
  // the field must hold its SAVED value afterwards, not ''.
  it('puts an edited field back to its saved value rather than blanking it', async () => {
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.clear(screen.getByLabelText('Location'));
    await user.type(screen.getByLabelText('Location'), 'Somewhere else');
    await user.click(revert());

    expect(screen.getByLabelText('Location')).toHaveValue('Galle, Sri Lanka');
    expect(screen.getByLabelText('Contact email')).toHaveValue('pcgallege@gmail.com');
    expect(screen.getByLabelText('Bio paragraph 1')).toHaveValue('First paragraph.');
  });

  // ⚠️ A revert that left a file staged would be a HALF-revert, and the tell is
  // subtle: the text fields look restored, then SAVE uploads a portrait the owner
  // thought they had discarded. A text-only assertion would pass that bug.
  it('discards a staged portrait and résumé too', async () => {
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.upload(fileInputIn(card('Portrait')), png());
    await user.upload(fileInputIn(card('Résumé / CV')), pdf());
    await user.click(revert());

    expect(within(card('Portrait')).getByText('MISSING')).toBeInTheDocument();
    expect(within(card('Résumé / CV')).getByText('MISSING')).toBeInTheDocument();
    expect(screen.queryByText('UNSAVED CHANGES')).not.toBeInTheDocument();
    expect(save()).toBeDisabled();
  });

  it('cancels a staged removal', async () => {
    hooks.useAbout.mockReturnValue({ data: WITH_AVATAR, isLoading: false });
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.click(within(card('Portrait')).getByRole('button', { name: 'REMOVE' }));
    expect(within(card('Portrait')).getByText('REMOVE ON SAVE')).toBeInTheDocument();

    await user.click(revert());
    expect(within(card('Portrait')).getByText('LIVE')).toBeInTheDocument();
  });

  it('sends nothing — it is a local undo, not a request', async () => {
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.type(screen.getByLabelText('Location'), '!');
    await user.click(revert());

    expect(hooks.updateAbout.mutateAsync).not.toHaveBeenCalled();
    expect(hooks.removeAvatar.mutateAsync).not.toHaveBeenCalled();
  });

  it('clears a pick error', async () => {
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.upload(fileInputIn(card('Portrait')), png());
    fireEvent.change(fileInputIn(card('Résumé / CV')), {
      target: { files: [new File(['x'], 'no.txt', { type: 'text/plain' })] },
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await user.click(revert());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('social links (PF-112)', () => {
  const socialCard = () => card('Social links');

  // ⚠️ On a FIXED row the × CLEARS the URL — it cannot delete the key, because
  // `github`…`twitter` are schema fields with defaults. Clearing is what makes
  // the icon disappear from the public site, which is the actual goal.
  it('clears a fixed platform rather than deleting it', async () => {
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.click(within(socialCard()).getByRole('button', { name: 'Clear GitHub link' }));

    expect(screen.getByLabelText('GitHub URL')).toHaveValue('');
    await user.click(save());
    expect(hooks.updateAbout.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ social: expect.objectContaining({ github: '' }) })
    );
  });

  // The control only exists where there is something to clear — otherwise every
  // blank row would carry a dead button.
  it('offers no clear control on an already-empty platform', () => {
    render(<AdminAboutPanel />);

    expect(within(socialCard()).queryByRole('button', { name: /Clear Twitter/ }))
      .not.toBeInTheDocument();
    expect(within(socialCard()).getByRole('button', { name: 'Clear GitHub link' }))
      .toBeInTheDocument();
  });

  it('adds a custom link and sends both halves', async () => {
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.click(screen.getByRole('button', { name: '+ ADD LINK' }));
    await user.type(screen.getByLabelText('Link 1 name'), 'YouTube');
    await user.type(screen.getByLabelText('Link 1 URL'), 'https://youtube.com/@x');
    await user.click(save());

    expect(hooks.updateAbout.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        socialExtra: [{ label: 'YouTube', url: 'https://youtube.com/@x' }],
      })
    );
  });

  // ⚠️ On a CUSTOM row the × really does delete — name and URL together, because
  // it is an array element and not a fixed key.
  it('removes a custom link, name and URL together', async () => {
    hooks.useAbout.mockReturnValue({
      data: { ...ABOUT, socialExtra: [{ label: 'YouTube', url: 'https://youtube.com/@x' }] },
      isLoading: false,
    });
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    expect(screen.getByLabelText('Link 1 name')).toHaveValue('YouTube');
    await user.click(screen.getByRole('button', { name: 'Remove YouTube link' }));

    expect(screen.queryByLabelText('Link 1 name')).not.toBeInTheDocument();
    await user.click(save());
    expect(hooks.updateAbout.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ socialExtra: [] })
    );
  });

  /*
   * ⚠️ REWRITTEN 2026-09-25. These two used to be "explains why SAVE stays dim
   * with a name but no URL" — a proactive `.rowHint` shown as soon as one half
   * was filled, because SAVE went dim and there was no control to press.
   *
   * The owner's rule replaced that outright: SAVE is pressable, pressing it
   * REFUSES, and the reason prints under the offending input. So the assertion
   * moves from "a hint appears while you type" to "pressing SAVE refuses and
   * says which half is missing".
   */
  it.each([
    ['a name but no URL', { label: 'YouTube', url: '' }, 'Link 1 URL',  /Add a URL/i],
    ['a URL but no name', { label: '', url: 'https://youtube.com/@x' }, 'Link 1 name', /Add a name/i],
  ])('refuses the save with %s, and marks the missing half', async (_why, row, marked, message) => {
    hooks.useAbout.mockReturnValue({ data: { ...ABOUT, socialExtra: [row] }, isLoading: false });
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.type(screen.getByLabelText('Location'), '!');   // make it dirty
    await user.click(save());

    expect(hooks.updateAbout.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.getByLabelText(marked)).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows nothing until SAVE is actually pressed', async () => {
    // ⚠️ The other half of the rule, and the reason `clearField` clears rather
    // than re-validates: marking a field while it is still being typed in is
    // the behaviour everyone hates. Nothing is red until the owner asks to save.
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.click(screen.getByRole('button', { name: '+ ADD LINK' }));
    await user.type(screen.getByLabelText('Link 1 name'), 'YouTube');

    expect(screen.queryByText(/Add a (URL|name) to save/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Link 1 name')).not.toHaveAttribute('aria-invalid');
  });

  it('shows an empty state before any custom link exists', () => {
    render(<AdminAboutPanel />);
    expect(within(socialCard()).getByText(/No other links yet/i)).toBeInTheDocument();
  });

  /*
   * ⚠️ REVERSED 2026-09-25. This used to assert the row was silently DROPPED
   * from the payload and the save went through — "a half-filled row is the
   * normal in-progress state". That is exactly what the owner reported as
   * broken: you type a name, press SAVE, and the row is gone with no word said.
   * Now the save is refused until the row is finished or removed.
   */
  it('REFUSES the save on a half-filled row, and sends nothing', async () => {
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.click(screen.getByRole('button', { name: '+ ADD LINK' }));
    await user.type(screen.getByLabelText('Link 1 name'), 'YouTube');
    await user.click(save());

    expect(hooks.updateAbout.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText(/CHECK THE CHANGES AGAIN/i)).toBeInTheDocument();
  });

  it('refuses a row that is still completely blank', async () => {
    // Owner, 2026-09-25: "when i add a link tab pressing + icon in that tab it
    // should be fill before saving." Pressing + is a commitment; × is how it
    // is undone.
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.click(screen.getByRole('button', { name: '+ ADD LINK' }));
    await user.click(save());

    expect(hooks.updateAbout.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText(/remove the row/i)).toBeInTheDocument();
  });

  it('saves once the unfinished row is removed with its ×', async () => {
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.type(screen.getByLabelText('Location'), '!');
    await user.click(screen.getByRole('button', { name: '+ ADD LINK' }));
    await user.click(save());
    expect(hooks.updateAbout.mutateAsync).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Remove link 1' }));
    await user.click(save());

    expect(hooks.updateAbout.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ socialExtra: [] })
    );
  });

  // ⚠️ Distinct names, not five buttons all called "×". Required for a screen
  // reader, and required to assert NAMES rather than counts.
  it('gives every clear and remove control a distinct accessible name', async () => {
    hooks.useAbout.mockReturnValue({
      data: { ...ABOUT, socialExtra: [{ label: 'YouTube', url: 'https://youtube.com/@x' }] },
      isLoading: false,
    });
    render(<AdminAboutPanel />);

    const names = within(socialCard()).getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'))
      .filter(Boolean);

    expect(names).toContain('Clear GitHub link');
    expect(names).toContain('Clear LinkedIn link');
    expect(names).toContain('Remove YouTube link');
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('form hygiene', () => {
  // ⚠️ A <button> with no `type` inside a <form> IS a submit button. PF-97's
  // tag-delete confirm sat inside the post form and silently saved and closed
  // the post — it "looked like it worked", because the tag really was gone.
  // ⚠️ THIS SWEEP MUST RUN OVER EVERY STATE, and the first version of it did
  // not — it rendered only the default fixture, where neither REMOVE button
  // exists because nothing is stored. Mutation-testing caught that: dropping
  // `type="button"` from the résumé's REMOVE left all 36 tests green, because
  // the button under test was never on the page. The fixtures below are what
  // make the conditional controls render.
  it.each([
    ['nothing stored',      () => ABOUT],
    ['a stored résumé',     () => WITH_RESUME],
    ['a stored portrait',   () => WITH_AVATAR],
    ['both stored',         () => ({ ...WITH_RESUME, ...WITH_AVATAR })],
    // ⚠️ ADDED after mutation testing caught the sweep vacuous a SECOND time.
    // Every fixture above has `socialExtra: []`, so the custom-link remove
    // buttons never rendered in it — dropping their `type` left this sweep green
    // while only a behavioural test noticed. The lesson from part 1 recurred
    // because the guard was widened and its fixtures were not.
    ['a custom link',       () => ({
      ...ABOUT,
      socialExtra: [{ label: 'YouTube', url: 'https://youtube.com/@x' }],
    })],
  ])('gives every non-submit button type="button" with %s', (_state, data) => {
    hooks.useAbout.mockReturnValue({ data: data(), isLoading: false });
    const { container } = render(<AdminAboutPanel />);
    const buttons = [...container.querySelectorAll('button')];

    expect(buttons.length).toBeGreaterThan(4);
    const submits = buttons.filter((b) => b.getAttribute('type') === 'submit');
    expect(submits).toHaveLength(1);
    expect(submits[0]).toHaveTextContent(/SAVE PROFILE/i);
    buttons.filter((b) => b !== submits[0]).forEach((b) => {
      expect(b).toHaveAttribute('type', 'button');
    });
  });

  it('also covers the buttons that only exist while something is staged', async () => {
    const user = userEvent.setup();
    const { container } = render(<AdminAboutPanel />);

    await user.upload(fileInputIn(card('Portrait')), png());
    await user.upload(fileInputIn(card('Résumé / CV')), pdf());

    const undos = [...container.querySelectorAll('button')]
      .filter((b) => b.textContent === 'UNDO');
    expect(undos).toHaveLength(2);
    undos.forEach((b) => expect(b).toHaveAttribute('type', 'button'));
  });

  // ⚠️ The attribute sweep above says the markup is right; THIS says the
  // consequence is right. A no-type button inside a <form> is a submit button,
  // so REMOVE would have saved the whole profile — and it would have looked
  // like it worked, because the file really would be staged for removal. That
  // is precisely how PF-97's tag-delete confirm shipped.
  it.each([
    ['the résumé\u2019s',  () => WITH_RESUME,  'Résumé / CV'],
    ['the portrait\u2019s', () => WITH_AVATAR, 'Portrait'],
  ])('%s REMOVE does not submit the form', async (_whose, data, title) => {
    hooks.useAbout.mockReturnValue({ data: data(), isLoading: false });
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.click(within(card(title)).getByRole('button', { name: 'REMOVE' }));

    expect(hooks.updateAbout.mutateAsync).not.toHaveBeenCalled();
    expect(hooks.showFlash).not.toHaveBeenCalled();
  });

  // ⚠️ `display: none` / `hidden` would take the file input out of the focus
  // order, which is what makes the prototype's upload pill keyboard-unreachable.
  it('keeps both file inputs focusable rather than hidden', () => {
    const { container } = render(<AdminAboutPanel />);
    const inputs = [...container.querySelectorAll('input[type="file"]')];

    expect(inputs).toHaveLength(2);
    inputs.forEach((input) => {
      expect(input).not.toHaveAttribute('hidden');
      input.focus();
      expect(document.activeElement).toBe(input);
    });
  });

  it('marks the form dirty once something is staged', async () => {
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    expect(screen.queryByText('UNSAVED CHANGES')).not.toBeInTheDocument();
    await user.upload(fileInputIn(card('Portrait')), png());
    expect(screen.getByText('UNSAVED CHANGES')).toBeInTheDocument();
  });
});

describe('stat cards', () => {
  // The field this panel could never edit and the public page never read. Both
  // ends are wired now, so these assert the panel half: what reaches the PUT.
  const WITH_STATS = {
    ...ABOUT,
    stats: [
      { label: 'Projects Built', value: '5+' },
      { label: 'Learning',       value: 'Continuous' },
    ],
  };

  const statsCard = () => card('Stat cards');

  it('prefills a row per stored stat', () => {
    hooks.useAbout.mockReturnValue({ data: WITH_STATS, isLoading: false });
    render(<AdminAboutPanel />);

    expect(screen.getByLabelText('Stat 1 label')).toHaveValue('Projects Built');
    expect(screen.getByLabelText('Stat 1 value')).toHaveValue('5+');
    expect(screen.getByLabelText('Stat 2 label')).toHaveValue('Learning');
    expect(screen.getByLabelText('Stat 2 value')).toHaveValue('Continuous');
  });

  it('says the site falls back when there are none', () => {
    render(<AdminAboutPanel />);
    expect(within(statsCard()).getByText(/falls back to its four built-in ones/i))
      .toBeInTheDocument();
  });

  /*
   * ⚠️ REVERSED 2026-09-25 — this pair used to assert that + ADD STAT left the
   * form CLEAN and SAVE DIM, on the reasoning that a blank row would not be
   * sent so it was not a change. Sound reasoning, wrong conclusion: it left the
   * owner with an obviously-unfinished row, a dim button, and nothing to press
   * to find out why. That is the exact case reported.
   *
   * Adding a row is now a change, so SAVE lights up — and pressing it refuses.
   */
  it('+ ADD STAT appends a blank row and DOES dirty the form', async () => {
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.click(within(statsCard()).getByRole('button', { name: '+ ADD STAT' }));

    expect(screen.getByLabelText('Stat 1 label')).toHaveValue('');
    expect(save()).toBeEnabled();
  });

  it('refuses the save and marks the missing value — the reported case', async () => {
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.click(within(statsCard()).getByRole('button', { name: '+ ADD STAT' }));
    await user.type(screen.getByLabelText('Stat 1 label'), 'Commits');
    await user.click(save());

    expect(hooks.updateAbout.mutateAsync).not.toHaveBeenCalled();
    expect(within(statsCard()).getByText('Add a value to save this stat.'))
      .toBeInTheDocument();
    expect(screen.getByLabelText('Stat 1 value')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Stat 1 label')).not.toHaveAttribute('aria-invalid');
  });

  it('clears the mark as soon as the missing value is typed', async () => {
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.click(within(statsCard()).getByRole('button', { name: '+ ADD STAT' }));
    await user.type(screen.getByLabelText('Stat 1 label'), 'Commits');
    await user.click(save());
    expect(screen.getByLabelText('Stat 1 value')).toHaveAttribute('aria-invalid', 'true');

    await user.type(screen.getByLabelText('Stat 1 value'), '9');

    expect(screen.getByLabelText('Stat 1 value')).not.toHaveAttribute('aria-invalid');
    expect(within(statsCard()).queryByText('Add a value to save this stat.'))
      .not.toBeInTheDocument();
  });

  it('goes through once the row is complete', async () => {
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.click(within(statsCard()).getByRole('button', { name: '+ ADD STAT' }));
    await user.type(screen.getByLabelText('Stat 1 label'), 'Commits');
    await user.click(save());
    await user.type(screen.getByLabelText('Stat 1 value'), '900+');
    await user.click(save());

    expect(hooks.updateAbout.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ stats: [{ label: 'Commits', value: '900+' }] }),
    );
  });

  it('sends a completed row on SAVE', async () => {
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.click(within(statsCard()).getByRole('button', { name: '+ ADD STAT' }));
    await user.type(screen.getByLabelText('Stat 1 label'), 'Commits');
    await user.type(screen.getByLabelText('Stat 1 value'), '900+');
    await user.click(save());

    expect(hooks.updateAbout.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ stats: [{ label: 'Commits', value: '900+' }] }),
    );
  });

  it('edits a stored value through to the payload', async () => {
    hooks.useAbout.mockReturnValue({ data: WITH_STATS, isLoading: false });
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.clear(screen.getByLabelText('Stat 1 value'));
    await user.type(screen.getByLabelText('Stat 1 value'), '9+');
    await user.click(save());

    expect(hooks.updateAbout.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        stats: [
          { label: 'Projects Built', value: '9+' },
          { label: 'Learning', value: 'Continuous' },
        ],
      }),
    );
  });

  it('removes a row through a NAMED control, not a bare ×', async () => {
    // ⚠️ This panel already has five social clears, the custom-link removes and
    // the bio removes. Eight buttons whose accessible name is "×" are
    // indistinguishable to a screen reader and untestable by name — the
    // documented rule here is to assert NAMES, never counts.
    hooks.useAbout.mockReturnValue({ data: WITH_STATS, isLoading: false });
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.click(screen.getByRole('button', { name: 'Remove Projects Built stat' }));
    await user.click(save());

    expect(hooks.updateAbout.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ stats: [{ label: 'Learning', value: 'Continuous' }] }),
    );
  });

  it('sends [] when every stat is removed', async () => {
    // ⚠️ Not an omitted key. `updateAbout` does `$set: safe`, so leaving `stats`
    // out would keep the old rows in the database while the panel showed none —
    // a save that looks like it worked and did not.
    hooks.useAbout.mockReturnValue({ data: WITH_STATS, isLoading: false });
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.click(screen.getByRole('button', { name: 'Remove Projects Built stat' }));
    await user.click(screen.getByRole('button', { name: 'Remove Learning stat' }));
    await user.click(save());

    expect(hooks.updateAbout.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ stats: [] }),
    );
  });

  it('REVERT restores the saved stats rather than emptying them', async () => {
    hooks.useAbout.mockReturnValue({ data: WITH_STATS, isLoading: false });
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.clear(screen.getByLabelText('Stat 1 value'));
    await user.type(screen.getByLabelText('Stat 1 value'), '99+');
    await user.click(screen.getByRole('button', { name: /REVERT CHANGES/i }));

    expect(screen.getByLabelText('Stat 1 value')).toHaveValue('5+');
    expect(screen.getByLabelText('Stat 2 label')).toHaveValue('Learning');
    expect(save()).toBeDisabled();
  });
});

describe('the refusal itself — banner, shake, focus', () => {
  const dirtyThenSave = async (user) => {
    await user.type(screen.getByLabelText('Location'), '!');
    await user.click(save());
  };

  it('counts the problems in the banner, and does not list them there', async () => {
    // ⚠️ The banner names the SCALE; the detail lives under each field, which is
    // where it can be acted on. Listing every message in both places leaves two
    // things to read, one of which cannot say which input it means.
    hooks.useAbout.mockReturnValue({
      data: {
        ...ABOUT,
        email: 'broken@',
        stats: [{ label: 'Commits', value: '' }],
      },
      isLoading: false,
    });
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await dirtyThenSave(user);

    expect(screen.getByText(/CHECK THE CHANGES AGAIN — 2 fields need attention/i))
      .toBeInTheDocument();
  });

  it('says "field needs" for exactly one problem', async () => {
    hooks.useAbout.mockReturnValue({
      data: { ...ABOUT, email: 'broken@' }, isLoading: false,
    });
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await dirtyThenSave(user);

    expect(screen.getByText(/1 field needs attention/i)).toBeInTheDocument();
  });

  it('shakes the SAVE button on a refusal', async () => {
    hooks.useAbout.mockReturnValue({
      data: { ...ABOUT, email: 'broken@' }, isLoading: false,
    });
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await dirtyThenSave(user);
    expect(save().className).toMatch(/shake/);
  });

  it('REMOUNTS the button on a second refusal, so the shake restarts', async () => {
    /*
     * ⚠️ THE SECOND REFUSAL IS THE CASE THAT BREAKS, and it breaks silently.
     * Re-adding a class React has already rendered restarts no animation — the
     * element keeps it and the browser runs it once. So without the key bump
     * the button refuses visibly the first time and sits perfectly still every
     * time after, which reads as the button having stopped working.
     *
     * ⚠️ ASSERTED AS ELEMENT IDENTITY, not by driving the animation, because
     * `animationend` CANNOT BE FIRED IN THIS ENVIRONMENT AT ALL. Measured:
     * jsdom defines no `AnimationEvent` constructor, so testing-library's
     * `fireEvent.animationEnd` and a hand-built `new Event('animationend')`
     * both dispatch without error and React's `onAnimationEnd` never runs —
     * with or without `bubbles`. A test written the obvious way fails as though
     * the COMPONENT were broken.
     *
     * A changed `key` is what forces the remount, and a remount is what
     * restarts the animation, so a new DOM node is the mechanism itself rather
     * than a proxy for it. `onShakeEnd` is covered directly in
     * hooks/__tests__/useFormGuard.test.jsx, where it can just be called.
     */
    hooks.useAbout.mockReturnValue({
      data: { ...ABOUT, email: 'broken@' }, isLoading: false,
    });
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await dirtyThenSave(user);
    const first = save();
    expect(first.className).toMatch(/shake/);

    await user.click(save());
    const second = save();

    expect(second).not.toBe(first);          // a NEW node — the key changed
    expect(second.className).toMatch(/shake/);
  });

  it('focuses the FIRST offending field', async () => {
    hooks.useAbout.mockReturnValue({
      data: {
        ...ABOUT,
        email: 'broken@',
        stats: [{ label: 'Commits', value: '' }],
      },
      isLoading: false,
    });
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await dirtyThenSave(user);

    // The guard defers focus a frame, so the paint carrying aria-invalid has
    // landed before it looks the element up.
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText('Contact email')));
  });

  it('clears the banner once the form saves', async () => {
    hooks.useAbout.mockReturnValue({
      data: { ...ABOUT, email: 'broken@' }, isLoading: false,
    });
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await dirtyThenSave(user);
    expect(screen.getByText(/CHECK THE CHANGES AGAIN/i)).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Contact email'));
    await user.type(screen.getByLabelText('Contact email'), 'pcgallege@gmail.com');
    await user.click(save());

    expect(hooks.updateAbout.mutateAsync).toHaveBeenCalled();
    expect(screen.queryByText(/CHECK THE CHANGES AGAIN/i)).not.toBeInTheDocument();
  });

  it('REVERT drops the marks along with the edits', async () => {
    hooks.useAbout.mockReturnValue({
      data: { ...ABOUT, email: 'broken@' }, isLoading: false,
    });
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await dirtyThenSave(user);
    await user.click(screen.getByRole('button', { name: /REVERT CHANGES/i }));

    expect(screen.queryByText(/CHECK THE CHANGES AGAIN/i)).not.toBeInTheDocument();
  });

  it('turns the browser\'s own validation bubble off', () => {
    // ⚠️ Without `noValidate` a native `required` fires a bubble that pre-empts
    // onSubmit entirely, and this panel's validation never runs. That is not
    // hypothetical — it is what has been happening in AdminBlogPanel, whose
    // "Title is required." branch has never once executed.
    const { container } = render(<AdminAboutPanel />);
    expect(container.querySelector('form')).toHaveAttribute('novalidate');
  });
});

/*
 * ⚠️ THE TWO SOCIAL RULES, PINNED TOGETHER, AT THE COMPONENT LEVEL.
 *
 * They sit in the same card and look identical — an empty text input — and they
 * are opposite cases. Owner, 2026-09-25: "there is a twitter Url and its empty
 * its ok… but when i add a link tab pressing + icon in that tab it should be
 * fill before saving."
 *
 * `aboutForm.test.js` pins the same pair at the validator level. It is worth
 * having BOTH: the validator test proves the rule, this one proves the panel
 * actually routes each field to it — a panel that passed the wrong path string
 * for the fixed fields would mark them and still pass the unit test.
 */
describe('a blank FIXED social field is fine; a blank ADDED row is not', () => {
  it('saves happily with every fixed social URL cleared', async () => {
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.click(screen.getByRole('button', { name: 'Clear GitHub link' }));
    await user.click(screen.getByRole('button', { name: 'Clear LinkedIn link' }));
    await user.click(save());

    expect(hooks.updateAbout.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        social: expect.objectContaining({ github: '', linkedin: '', twitter: '' }),
      }),
    );
  });

  it('never marks the empty twitter field the site ships with', async () => {
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    // Force a refusal for an unrelated reason, so the marks are definitely on.
    await user.click(screen.getByRole('button', { name: '+ ADD LINK' }));
    await user.click(save());

    expect(screen.getByText(/remove the row/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Twitter URL')).not.toHaveAttribute('aria-invalid');
  });

  it('DOES mark a fixed field that is filled in but malformed', async () => {
    // The exemption is for EMPTY, not for "anything in a fixed field".
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

    await user.clear(screen.getByLabelText('GitHub URL'));
    await user.type(screen.getByLabelText('GitHub URL'), 'github.com/me');
    await user.click(save());

    expect(hooks.updateAbout.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByLabelText('GitHub URL')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/starting with https/i)).toBeInTheDocument();
  });
});
