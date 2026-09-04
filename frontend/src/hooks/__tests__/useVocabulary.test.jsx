// frontend/src/hooks/__tests__/useVocabulary.test.jsx
//
// PF-97 — the cache-invalidation contract for the tag vocabulary.
//
// ⚠️ WHY THIS FILE EXISTS AT ALL, given the panel already has component
// tests: `DELETE /api/vocabulary/tag/:id` is a CASCADING delete. The
// controller `$pull`s the value out of every blog post before removing the
// row, so the blog caches are stale the instant it returns.
//
// A component test cannot see that. It asserts what the user sees in the
// panel, and the panel looks perfectly correct while holding stale posts —
// the damage shows up later, somewhere else, as tags rendering on the
// public site that no longer exist in the database. That is exactly the
// shape of bug the repo's own notes describe as "looks like the delete
// didn't work, hours later". So the contract gets pinned where it lives:
// on the hook.
//
// This is the first test under src/hooks/__tests__/ — a directory CLAUDE.md
// already documents as the convention.
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const vocabularyService = vi.hoisted(() => ({
  list:   vi.fn(),
  impact: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('../../services/vocabularyService', () => ({ vocabularyService }));

const { useCreateVocabulary, useDeleteVocabulary, vocabKey } = await import('../useVocabulary');
const { BLOG_KEY, BLOG_ADMIN_KEY } = await import('../useBlog');

let client;
let invalidated;

const wrapper = ({ children }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

/** The queryKeys passed to every invalidateQueries call, as JSON. */
const invalidatedKeys = () => invalidated.map((c) => JSON.stringify(c[0].queryKey));

beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  invalidated = [];
  const real = client.invalidateQueries.bind(client);
  vi.spyOn(client, 'invalidateQueries').mockImplementation((...args) => {
    invalidated.push(args);
    return real(...args);
  });
});

describe('useDeleteVocabulary — the cascade contract', () => {

  it('invalidates the blog caches, not just the vocabulary list', async () => {
    vocabularyService.remove.mockResolvedValue({
      deleted: 'Docker', strippedFrom: 3, label: 'blog posts', transactional: true,
    });

    const { result } = renderHook(() => useDeleteVocabulary('tag'), { wrapper });
    await result.current.mutateAsync('chip-1');

    await waitFor(() => expect(invalidated.length).toBeGreaterThan(0));

    const keys = invalidatedKeys();
    expect(keys).toContain(JSON.stringify(vocabKey('tag')));
    // These two are the point of the test. Without them the admin list and
    // the public site keep rendering a tag the server just deleted.
    expect(keys).toContain(JSON.stringify(BLOG_KEY));
    expect(keys).toContain(JSON.stringify(BLOG_ADMIN_KEY));
  });

  it('passes the id straight through to the service', async () => {
    vocabularyService.remove.mockResolvedValue({ deleted: 'Docker', strippedFrom: 0 });

    const { result } = renderHook(() => useDeleteVocabulary('tag'), { wrapper });
    await result.current.mutateAsync('chip-42');

    expect(vocabularyService.remove).toHaveBeenCalledWith('tag', 'chip-42');
  });

  // `tech` cascades onto Projects, not Blog. Invalidating the blog keys
  // there would be wrong, and wiring the project keys for a caller that
  // does not exist yet is how an untested branch ships.
  it('does not invalidate blog caches for a tech deletion', async () => {
    vocabularyService.remove.mockResolvedValue({ deleted: 'Redis', strippedFrom: 1 });

    const { result } = renderHook(() => useDeleteVocabulary('tech'), { wrapper });
    await result.current.mutateAsync('chip-9');

    await waitFor(() => expect(invalidated.length).toBeGreaterThan(0));

    const keys = invalidatedKeys();
    expect(keys).toContain(JSON.stringify(vocabKey('tech')));
    expect(keys).not.toContain(JSON.stringify(BLOG_KEY));
    expect(keys).not.toContain(JSON.stringify(BLOG_ADMIN_KEY));
  });

  it('does not invalidate anything when the delete fails', async () => {
    vocabularyService.remove.mockRejectedValue(new Error('nope'));

    const { result } = renderHook(() => useDeleteVocabulary('tag'), { wrapper });
    await expect(result.current.mutateAsync('chip-1')).rejects.toThrow('nope');

    expect(invalidated).toHaveLength(0);
  });
});

describe('useCreateVocabulary', () => {

  it('refreshes the chip list after adding', async () => {
    vocabularyService.create.mockResolvedValue({ _id: 'new', type: 'tag', value: 'Vitest' });

    const { result } = renderHook(() => useCreateVocabulary('tag'), { wrapper });
    await result.current.mutateAsync('Vitest');

    await waitFor(() => expect(invalidated.length).toBeGreaterThan(0));
    expect(invalidatedKeys()).toContain(JSON.stringify(vocabKey('tag')));
  });

  // A create does not touch existing posts, so it must NOT invalidate them.
  it('leaves the blog caches alone', async () => {
    vocabularyService.create.mockResolvedValue({ _id: 'new', type: 'tag', value: 'Vitest' });

    const { result } = renderHook(() => useCreateVocabulary('tag'), { wrapper });
    await result.current.mutateAsync('Vitest');

    await waitFor(() => expect(invalidated.length).toBeGreaterThan(0));
    expect(invalidatedKeys()).not.toContain(JSON.stringify(BLOG_KEY));
  });

  it('sends the value to the service', async () => {
    vocabularyService.create.mockResolvedValue({ _id: 'new', value: 'Vitest' });

    const { result } = renderHook(() => useCreateVocabulary('tag'), { wrapper });
    await result.current.mutateAsync('Vitest');

    expect(vocabularyService.create).toHaveBeenCalledWith('tag', 'Vitest');
  });
});
