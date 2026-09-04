// frontend/src/components/admin/panels/__tests__/AdminBlogPanel.test.jsx
//
// PF-97 — the first component test for an admin panel.
//
// Scope is kept to the behaviour this ticket repaired rather than the
// panel's whole surface: Sprint 14 rebuilds this panel's appearance, so
// pinning its current styling here would just manufacture failures for
// that ticket to clean up. What is pinned is what must survive the
// restyle — that a post's real body reaches the editor, that what leaves
// the editor is a valid sections payload, and that a failure is visible.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// vi.mock over the hooks module, not a QueryClientProvider: the panel's
// data layer is not what is under test, and Vite's SSR transform makes
// each export a getter-only property that vi.spyOn cannot redefine.
// Same pattern as BlogSection.test.jsx.
const useBlogPostAdmin = vi.hoisted(() => vi.fn());
const createMutation   = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
const updateMutation   = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
const toggleMutation   = vi.hoisted(() => ({ mutate: vi.fn(),      isPending: false }));
const deleteMutation   = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));

const useVocabulary       = vi.hoisted(() => vi.fn());
const useVocabularyImpact = vi.hoisted(() => vi.fn());
const createVocabMutation = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
const deleteVocabMutation = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));

vi.mock('../../../../hooks/useVocabulary', () => ({
  useVocabulary:         useVocabulary,
  useVocabularyImpact:   useVocabularyImpact,
  useCreateVocabulary:   () => createVocabMutation,
  useDeleteVocabulary:   () => deleteVocabMutation,
}));

vi.mock('../../../../hooks/useBlog', () => ({
  useBlogPostAdmin: useBlogPostAdmin,
  useCreatePost:    () => createMutation,
  useUpdatePost:    () => updateMutation,
  useTogglePublish: () => toggleMutation,
  useDeletePost:    () => deleteMutation,
}));

const { AdminBlogPanel } = await import('../AdminBlogPanel');

// Shaped as GET /api/blog/admin/all really returns a post: the aggregation
// excludes `content` only, so `sections` is present and every server-owned
// field below genuinely arrives at the panel.
const POST = {
  _id:                'post-1',
  title:              'How I Built My MERN Portfolio',
  slug:               'how-i-built-my-mern-portfolio',
  excerpt:            'Eight sprints and a pipeline that says no.',
  tags:               ['React', 'Node.js'],
  published:          true,
  readingTimeMinutes: 6,
  views:              42,
  publishedAt:        '2026-07-14T00:00:00.000Z',
  createdAt:          '2026-08-30T10:00:00.000Z',
  sections: [
    { heading: 'Introduction', body: ['I wanted my portfolio to do more.'], bullets: [] },
    { heading: 'Planning',     body: [], bullets: ['Jira board', 'Branching strategy'] },
  ],
};

// Rows as GET /api/vocabulary/tag returns them.
const CHIPS = [
  { _id: 'c1', type: 'tag', value: 'React' },
  { _id: 'c2', type: 'tag', value: 'Docker' },
  { _id: 'c3', type: 'tag', value: 'Python' },
];


/**
 * The chip's pick/unpick button.
 *
 * ⚠️ `getByRole('button', { name: /React/ })` matches TWO elements — the
 * label button and the × beside it, whose aria-label is "Remove React from
 * the tag list". Anchoring on the +/✓ marker is what separates them.
 */
const chip = (value) => screen.getByRole('button', { name: new RegExp(`^[+✓]\\s*${value}$`) });

/** The × on a chip. */
const chipRemove = (value) =>
  screen.getByRole('button', { name: `Remove ${value} from the tag list` });

/** The confirm dialog, so its Cancel is not confused with the form's. */
const dialog = () => within(screen.getByRole('dialog'));

const openEditor = async (user) => {
  render(<AdminBlogPanel />);
  await user.click(screen.getByRole('button', { name: 'Edit' }));
};

beforeEach(() => {
  vi.clearAllMocks();
  createMutation.mutateAsync.mockResolvedValue({});
  updateMutation.mutateAsync.mockResolvedValue({});
  deleteMutation.mutateAsync.mockResolvedValue({});
  useBlogPostAdmin.mockReturnValue({ data: [POST], isLoading: false });

  createVocabMutation.mutateAsync.mockImplementation((value) =>
    Promise.resolve({ _id: `new-${value}`, type: 'tag', value }));
  deleteVocabMutation.mutateAsync.mockResolvedValue({
    deleted: 'Docker', strippedFrom: 3, label: 'blog posts',
  });
  useVocabulary.mockReturnValue({ data: CHIPS, isLoading: false });
  useVocabularyImpact.mockReturnValue({
    data: { value: 'Docker', type: 'tag', affected: 3, label: 'blog posts' },
    isLoading: false, isError: false,
  });
});

describe('AdminBlogPanel — Edit opens the post’s real body (the PF-97 bug)', () => {

  it('fills the editor with the post’s sections', async () => {
    const user = userEvent.setup();
    await openEditor(user);

    // Before PF-97 the editor showed one empty `content` textarea and none
    // of this was reachable.
    expect(screen.getByDisplayValue('Introduction')).toBeInTheDocument();
    expect(screen.getByDisplayValue('I wanted my portfolio to do more.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Planning')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Jira board')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Branching strategy')).toBeInTheDocument();
  });

  it('fills title, excerpt and tags', async () => {
    const user = userEvent.setup();
    await openEditor(user);

    expect(screen.getByLabelText(/^Title/)).toHaveValue(POST.title);
    expect(screen.getByLabelText(/^Excerpt/)).toHaveValue(POST.excerpt);
    expect(screen.getByLabelText(/^Tags/)).toHaveValue('React, Node.js');
  });

  // The deprecated field is what made the panel unusable. If a later pass
  // "restores" the prototype's markdown textarea, this fails.
  it('has no Content field at all', async () => {
    const user = userEvent.setup();
    await openEditor(user);

    expect(screen.queryByLabelText(/Content/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Markdown supported/i)).not.toBeInTheDocument();
  });
});

describe('AdminBlogPanel — editing sections', () => {

  it('adds a section', async () => {
    const user = userEvent.setup();
    await openEditor(user);

    expect(screen.getAllByLabelText(/^Heading/)).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: '+ Add Section' }));
    expect(screen.getAllByLabelText(/^Heading/)).toHaveLength(3);
  });

  it('removes a section', async () => {
    const user = userEvent.setup();
    await openEditor(user);

    await user.click(screen.getByRole('button', { name: 'Remove section 01' }));

    expect(screen.queryByDisplayValue('Introduction')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Planning')).toBeInTheDocument();
  });

  it('adds a paragraph to a section without touching its neighbour', async () => {
    const user = userEvent.setup();
    await openEditor(user);

    // Section 02 starts with no paragraphs — bullets only.
    const before = screen.getAllByPlaceholderText(/^Paragraph/).length;
    await user.click(screen.getAllByRole('button', { name: '+ Add paragraph' })[1]);

    expect(screen.getAllByPlaceholderText(/^Paragraph/)).toHaveLength(before + 1);
    // The first section's own paragraph is untouched — the shared-array bug
    // this would surface is invisible in the data and obvious on screen.
    expect(screen.getByDisplayValue('I wanted my portfolio to do more.')).toBeInTheDocument();
  });

  it('moves a section down, changing the reading order', async () => {
    const user = userEvent.setup();
    await openEditor(user);

    await user.click(screen.getByRole('button', { name: 'Move section 01 down' }));
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    const { data } = updateMutation.mutateAsync.mock.calls[0][0];
    expect(data.sections.map((s) => s.heading)).toEqual(['Planning', 'Introduction']);
  });

  it('disables Move up on the first section and Move down on the last', async () => {
    const user = userEvent.setup();
    await openEditor(user);

    expect(screen.getByRole('button', { name: 'Move section 01 up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move section 02 down' })).toBeDisabled();
  });
});

describe('AdminBlogPanel — what the save actually sends', () => {

  it('sends sections, and never the deprecated content field', async () => {
    const user = userEvent.setup();
    await openEditor(user);

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(updateMutation.mutateAsync).toHaveBeenCalledTimes(1);
    const { id, data } = updateMutation.mutateAsync.mock.calls[0][0];

    expect(id).toBe('post-1');
    expect(data).not.toHaveProperty('content');
    expect(data.sections).toEqual(POST.sections);
  });

  // Each of these is server-owned. The old `setForm({ ...post })` PUT them
  // all straight back; echoing `readingTimeMinutes` in particular asks
  // PF-95's hook to skip its recompute.
  it.each(['_id', 'slug', 'views', 'createdAt', 'publishedAt', 'readingTimeMinutes'])(
    'does not send back the server-owned %s',
    async (field) => {
      const user = userEvent.setup();
      await openEditor(user);
      await user.click(screen.getByRole('button', { name: 'Save Changes' }));

      expect(updateMutation.mutateAsync.mock.calls[0][0].data).not.toHaveProperty(field);
    },
  );
});

describe('AdminBlogPanel — failures are visible', () => {

  it('shows the server’s message when a save is rejected', async () => {
    updateMutation.mutateAsync.mockRejectedValue({
      response: { status: 400, data: { message: 'A post needs a body — add at least one section' } },
    });

    const user = userEvent.setup();
    await openEditor(user);
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText(/A post needs a body/)).toBeInTheDocument();
  });

  // The lesson utils/loginError.js was written for: an unreachable server
  // is not a rejected post, and must not read like one.
  it('distinguishes an unreachable server from a rejected post', async () => {
    updateMutation.mutateAsync.mockRejectedValue({ message: 'Network Error' });

    const user = userEvent.setup();
    await openEditor(user);
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText(/Cannot reach the server/)).toBeInTheDocument();
  });

  it('blocks the save and explains why when a section has no text', async () => {
    const user = userEvent.setup();
    await openEditor(user);

    // Empty section 01's only paragraph, leaving a heading with no body.
    await user.clear(screen.getByDisplayValue('I wanted my portfolio to do more.'));
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('Section 01 needs at least one paragraph or bullet.')).toBeInTheDocument();
    expect(updateMutation.mutateAsync).not.toHaveBeenCalled();
  });
});

describe('AdminBlogPanel — list view', () => {

  // PF-95 made publishedAt the displayed date on the site; the panel still
  // printed createdAt, so the same post showed two different dates.
  it('prints the publish date, not the insert stamp', async () => {
    render(<AdminBlogPanel />);

    const expected = new Date(POST.publishedAt).toLocaleDateString();
    const notExpected = new Date(POST.createdAt).toLocaleDateString();

    expect(screen.getByText(new RegExp(expected.replace(/[/.]/g, '\\$&')))).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(notExpected.replace(/[/.]/g, '\\$&')))).not.toBeInTheDocument();
  });

  it('falls back to the insert stamp when a post has no publish date', async () => {
    useBlogPostAdmin.mockReturnValue({
      data: [{ ...POST, publishedAt: null }], isLoading: false,
    });
    render(<AdminBlogPanel />);

    const expected = new Date(POST.createdAt).toLocaleDateString();
    expect(screen.getByText(new RegExp(expected.replace(/[/.]/g, '\\$&')))).toBeInTheDocument();
  });

  it('surfaces a failed publish toggle', async () => {
    toggleMutation.mutate.mockImplementation((_id, { onError }) =>
      onError({ response: { data: { message: 'Post not found' } } }));

    const user = userEvent.setup();
    render(<AdminBlogPanel />);
    await user.click(screen.getByRole('button', { name: 'Unpublish' }));

    expect(await screen.findByText('Post not found')).toBeInTheDocument();
  });
});

// ── PF-97: the shared tag vocabulary picker ───────────────────────────
// The API behind this shipped in Sprint 9 (PF-61/PF-62) with zero frontend
// consumers. These pin the three actions apart, because they differ wildly
// in consequence: toggling is local, adding is one row, and `×` deletes a
// tag across every post in the database.
describe('AdminBlogPanel — tag picker', () => {

  it('renders a chip per vocabulary row', async () => {
    const user = userEvent.setup();
    await openEditor(user);

    expect(chip('React')).toBeInTheDocument();
    expect(chip('Docker')).toBeInTheDocument();
    expect(chip('Python')).toBeInTheDocument();
  });

  // POST carries tags React and Node.js, so React is selected and Docker
  // is not — the picker must reflect the post it opened, not a default.
  it('marks chips the post already carries as selected', async () => {
    const user = userEvent.setup();
    await openEditor(user);

    expect(chip('React')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('Docker')).toHaveAttribute('aria-pressed', 'false');
  });

  it('adds the tag to the field when an unselected chip is clicked', async () => {
    const user = userEvent.setup();
    await openEditor(user);

    await user.click(chip('Docker'));

    expect(screen.getByLabelText(/^Tags/)).toHaveValue('React, Node.js, Docker');
    expect(chip('Docker')).toHaveAttribute('aria-pressed', 'true');
  });

  it('removes the tag from the field when a selected chip is clicked', async () => {
    const user = userEvent.setup();
    await openEditor(user);

    await user.click(chip('React'));

    expect(screen.getByLabelText(/^Tags/)).toHaveValue('Node.js');
  });

  it('sends the picked tags with the save', async () => {
    const user = userEvent.setup();
    await openEditor(user);

    await user.click(chip('Docker'));
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(updateMutation.mutateAsync.mock.calls[0][0].data.tags)
      .toEqual(['React', 'Node.js', 'Docker']);
  });

  describe('+ ADD TAG', () => {

    it('creates the tag and selects it immediately', async () => {
      const user = userEvent.setup();
      await openEditor(user);

      await user.type(screen.getByLabelText('New tag name'), 'Vitest');
      await user.click(screen.getByRole('button', { name: '+ ADD TAG' }));

      expect(createVocabMutation.mutateAsync).toHaveBeenCalledWith('Vitest');
      expect(await screen.findByDisplayValue('React, Node.js, Vitest')).toBeInTheDocument();
    });

    // A POST for a value already in the pool would 409. The design's own
    // addChip() skips the insert and falls through to selecting it.
    it('picks an existing tag instead of posting a duplicate', async () => {
      const user = userEvent.setup();
      await openEditor(user);

      await user.type(screen.getByLabelText('New tag name'), 'docker');
      await user.click(screen.getByRole('button', { name: '+ ADD TAG' }));

      expect(createVocabMutation.mutateAsync).not.toHaveBeenCalled();
      expect(screen.getByLabelText(/^Tags/)).toHaveValue('React, Node.js, Docker');
    });

    // The input sits inside the post <form>, where Enter submits by default.
    it('does not submit the post when Enter is pressed in the tag box', async () => {
      const user = userEvent.setup();
      await openEditor(user);

      await user.type(screen.getByLabelText('New tag name'), 'Vitest{Enter}');

      expect(updateMutation.mutateAsync).not.toHaveBeenCalled();
      expect(createVocabMutation.mutateAsync).toHaveBeenCalledWith('Vitest');
    });

    it('surfaces a failed create', async () => {
      createVocabMutation.mutateAsync.mockRejectedValue({
        response: { data: { message: '"Vitest" already exists in this vocabulary' } },
      });

      const user = userEvent.setup();
      await openEditor(user);
      await user.type(screen.getByLabelText('New tag name'), 'Vitest');
      await user.click(screen.getByRole('button', { name: '+ ADD TAG' }));

      expect(await screen.findByText(/already exists in this vocabulary/)).toBeInTheDocument();
    });
  });

  describe('× — the cascading delete', () => {

    it('asks for confirmation naming how many posts are affected', async () => {
      const user = userEvent.setup();
      await openEditor(user);

      await user.click(chipRemove('Docker'));

      expect(await screen.findByText(/removes it from 3 blog posts/i)).toBeInTheDocument();
      // Nothing is deleted merely by opening the dialog.
      expect(deleteVocabMutation.mutateAsync).not.toHaveBeenCalled();
    });

    // A count of 0 rendered while the request is in flight is a confident
    // lie at the exact moment the reader decides.
    it('withholds the count and blocks confirming until the impact lands', async () => {
      useVocabularyImpact.mockReturnValue({ data: undefined, isLoading: true, isError: false });

      const user = userEvent.setup();
      await openEditor(user);
      await user.click(chipRemove('Docker'));

      expect(await screen.findByText(/checking how many posts use it/i)).toBeInTheDocument();
      expect(dialog().getByRole('button', { name: 'Yes, Remove' })).toBeDisabled();
    });

    it('says so when the impact cannot be checked', async () => {
      useVocabularyImpact.mockReturnValue({ data: undefined, isLoading: false, isError: true });

      const user = userEvent.setup();
      await openEditor(user);
      await user.click(chipRemove('Docker'));

      expect(await screen.findByText(/safer to cancel/i)).toBeInTheDocument();
      expect(dialog().getByRole('button', { name: 'Yes, Remove' })).toBeDisabled();
    });

    it('reads naturally when exactly one post is affected', async () => {
      useVocabularyImpact.mockReturnValue({
        data: { value: 'Docker', affected: 1, label: 'blog posts' },
        isLoading: false, isError: false,
      });

      const user = userEvent.setup();
      await openEditor(user);
      await user.click(chipRemove('Docker'));

      expect(await screen.findByText(/removes it from 1 blog post\./i)).toBeInTheDocument();
    });

    it('states plainly when nothing is affected', async () => {
      useVocabularyImpact.mockReturnValue({
        data: { value: 'Docker', affected: 0, label: 'blog posts' },
        isLoading: false, isError: false,
      });

      const user = userEvent.setup();
      await openEditor(user);
      await user.click(chipRemove('Docker'));

      expect(await screen.findByText(/No blog posts currently use it/i)).toBeInTheDocument();
    });

    it('cancelling deletes nothing', async () => {
      const user = userEvent.setup();
      await openEditor(user);

      await user.click(chipRemove('Docker'));
      await user.click(dialog().getByRole('button', { name: 'Cancel' }));

      expect(deleteVocabMutation.mutateAsync).not.toHaveBeenCalled();
    });

    // The open post is unsaved form state no refetch can reach. Without the
    // local strip, the deleted tag sits in the field and is re-created on
    // the next save.
    it('strips the deleted tag from the post being edited', async () => {
      useVocabularyImpact.mockReturnValue({
        data: { value: 'React', affected: 2, label: 'blog posts' },
        isLoading: false, isError: false,
      });

      const user = userEvent.setup();
      await openEditor(user);
      expect(screen.getByLabelText(/^Tags/)).toHaveValue('React, Node.js');

      await user.click(chipRemove('React'));
      await user.click(dialog().getByRole('button', { name: 'Yes, Remove' }));

      expect(await screen.findByDisplayValue('Node.js')).toBeInTheDocument();
    });

    // ⚠️ REGRESSION GUARD. This dialog renders inside the post <form>, so a
    // <button> without type="button" defaults to type="submit". Before that
    // attribute was added, confirming a tag deletion ALSO saved the whole
    // post and closed the editor — the tag really was deleted, so the action
    // looked like it worked, while quietly doing something much larger.
    it('does not submit the post when the tag deletion is confirmed', async () => {
      useVocabularyImpact.mockReturnValue({
        data: { value: 'Docker', affected: 1, label: 'blog posts' },
        isLoading: false, isError: false,
      });

      const user = userEvent.setup();
      await openEditor(user);
      await user.click(chipRemove('Docker'));
      await user.click(dialog().getByRole('button', { name: 'Yes, Remove' }));

      expect(deleteVocabMutation.mutateAsync).toHaveBeenCalledTimes(1);
      expect(updateMutation.mutateAsync).not.toHaveBeenCalled();
      // The editor is still open — the form did not submit out from under it.
      expect(screen.getByLabelText(/^Tags/)).toBeInTheDocument();
    });

    it('does not submit the post when the tag deletion is cancelled', async () => {
      const user = userEvent.setup();
      await openEditor(user);
      await user.click(chipRemove('Docker'));
      await user.click(dialog().getByRole('button', { name: 'Cancel' }));

      expect(updateMutation.mutateAsync).not.toHaveBeenCalled();
      expect(screen.getByLabelText(/^Tags/)).toBeInTheDocument();
    });

    it('surfaces a failed delete', async () => {
      deleteVocabMutation.mutateAsync.mockRejectedValue({
        response: { data: { message: 'No vocabulary item found with that ID' } },
      });

      const user = userEvent.setup();
      await openEditor(user);
      await user.click(chipRemove('Docker'));
      await user.click(dialog().getByRole('button', { name: 'Yes, Remove' }));

      expect(await screen.findByText(/No vocabulary item found/)).toBeInTheDocument();
    });
  });

  it('offers to add one when the vocabulary is empty', async () => {
    useVocabulary.mockReturnValue({ data: [], isLoading: false });

    const user = userEvent.setup();
    await openEditor(user);

    expect(screen.getByText(/No tags in the list yet/i)).toBeInTheDocument();
  });
});
