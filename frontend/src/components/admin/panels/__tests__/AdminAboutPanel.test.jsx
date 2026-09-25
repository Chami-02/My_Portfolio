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
import { render, screen, within, fireEvent } from '@testing-library/react';
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
  social: { github: 'https://github.com/Chami-02', linkedin: 'https://linkedin.com/in/x' },
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
  it('fills the five basic fields from the document', () => {
    render(<AdminAboutPanel />);

    expect(screen.getByLabelText('Full name')).toHaveValue('Parindra Gallage');
    expect(screen.getByLabelText('Job title')).toHaveValue('Full-Stack Developer');
    expect(screen.getByLabelText('Location')).toHaveValue('Galle, Sri Lanka');
    expect(screen.getByLabelText('Contact email')).toHaveValue('pcgallege@gmail.com');
    expect(screen.getByLabelText('Availability note')).toHaveValue('Open to junior roles');
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
  it('sends only the profile when nothing is staged', async () => {
    const user = userEvent.setup();
    render(<AdminAboutPanel />);

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

    await user.clear(screen.getByLabelText('Job title'));
    await user.type(screen.getByLabelText('Job title'), 'Software Engineer');
    await user.click(save());

    expect(hooks.updateAbout.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Software Engineer' })
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
