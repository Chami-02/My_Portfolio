// frontend/src/hooks/__tests__/useBlog.test.jsx
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getPublished = vi.hoisted(() => vi.fn(() => Promise.resolve([])));
vi.mock('../../services/blogService', () => ({ blogService: { getPublished } }));

const { blogListParams, useBlogPosts, BLOG_KEY, BLOG_ADMIN_KEY, useBlogPost } =
  await import('../useBlog');

describe('blogListParams', () => {
  it('drops an absent filter entirely', () => {
    expect(blogListParams()).toEqual({});
    expect(blogListParams({})).toEqual({});
  });

  it('drops an empty or whitespace-only query', () => {
    expect(blogListParams({ q: '' })).toEqual({});
    expect(blogListParams({ q: '   ' })).toEqual({});
  });

  it('trims a real query rather than sending the spaces', () => {
    expect(blogListParams({ q: '  docker ' })).toEqual({ q: 'docker' });
  });

  /**
   * `'All'` is the chip row's own prepended label, not a tag. The server
   * already treats it as no filter (`buildMatch` in
   * backend/src/utils/blogQuery.js), and these rules MIRROR that on purpose:
   * a param the server would ignore must not reach the cache key either, or
   * two keys map to one response and the same list is cached twice.
   */
  it.each(['All', 'all', 'ALL', '  All  '])('treats %s as no tag filter', (tag) => {
    expect(blogListParams({ tag })).toEqual({});
  });

  it('keeps a real tag, and keeps its casing', () => {
    expect(blogListParams({ tag: 'GitHub Actions' })).toEqual({ tag: 'GitHub Actions' });
  });

  it('combines the two', () => {
    expect(blogListParams({ q: 'api', tag: 'Java' })).toEqual({ q: 'api', tag: 'Java' });
  });

  it('ignores non-string input rather than coercing it', () => {
    expect(blogListParams({ q: 5, tag: null })).toEqual({});
  });
});

describe('useBlogPosts cache identity', () => {
  let client;
  const wrapper = ({ children }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    getPublished.mockClear();
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
  });

  /**
   * ⚠️ THE LOAD-BEARING TEST OF THIS FILE, and the reason `blogListParams`
   * exists at all.
   *
   * BlogPage mounts TWO list queries — the filtered one it renders, and an
   * unfiltered one for the design's `N POSTS · ALL TOPICS` count, which a
   * server-filtered response cannot carry. While no filter is active those
   * two must collapse onto ONE cache entry, or every single visit to /blog
   * costs two identical round trips against a backend that rate-limits at
   * 100 req / 15 min / IP.
   *
   * ⚠️ Discriminating, not vacuous: remove the normalisation and
   * `{ q: '', tag: 'All' }` produces `['blog','list',{q:'',tag:'All'}]`,
   * which is a DIFFERENT key from `['blog','list',{}]` — the cache then
   * holds two entries and this fails. Verified by mutation, not assumed.
   */
  it('gives an unfiltered call and an all-defaults call the SAME key', () => {
    renderHook(() => {
      useBlogPosts();
      useBlogPosts({ q: '', tag: 'All' });
    }, { wrapper });

    const keys = client.getQueryCache().getAll().map((entry) => entry.queryKey);
    expect(keys).toHaveLength(1);
    expect(keys[0]).toEqual(['blog', 'list', {}]);
  });

  it('gives a filtered call a DIFFERENT key from the unfiltered one', () => {
    renderHook(() => {
      useBlogPosts();
      useBlogPosts({ q: 'docker' });
    }, { wrapper });

    expect(client.getQueryCache().getAll()).toHaveLength(2);
  });

  it('sends the normalised params to the service, not the raw ones', () => {
    renderHook(() => useBlogPosts({ q: '  docker  ', tag: 'All' }), { wrapper });
    expect(getPublished).toHaveBeenCalledWith({ q: 'docker' });
  });

  /**
   * The list key must stay reachable from `BLOG_KEY`, or every existing
   * mutation silently stops invalidating it — `useCreatePost`,
   * `useUpdatePost`, `useTogglePublish`, `useDeletePost` and
   * `useDeleteVocabulary` all invalidate the `['blog']` prefix.
   */
  it('keeps the list key under the BLOG_KEY prefix so mutations still invalidate it', () => {
    renderHook(() => useBlogPosts({ q: 'docker' }), { wrapper });
    const [key] = client.getQueryCache().getAll().map((e) => e.queryKey);
    expect(key.slice(0, BLOG_KEY.length)).toEqual(BLOG_KEY);
  });

  /**
   * The `'list'` segment is what keeps the list out of the post-detail
   * namespace. `useBlogPost(slug)` keys on `['blog', <slug>]`, so a
   * two-element list key would sit among every post.
   */
  it('does not collide with a post detail key', () => {
    renderHook(() => {
      useBlogPosts();
      useBlogPost('list');
    }, { wrapper });

    const keys = client.getQueryCache().getAll().map((e) => JSON.stringify(e.queryKey));
    expect(new Set(keys).size).toBe(keys.length);
  });

  /**
   * ⚠️ FOUND, NOT FIXED — reported to Outstanding work in PF-98.
   *
   * This asserts the CURRENT behaviour, which is a latent bug: a post whose
   * slug is `admin` produces exactly `BLOG_ADMIN_KEY`, so the post detail and
   * the admin list share one cache entry. It is pre-existing (both keys
   * predate PF-98) and out of this ticket's scope, but it is written down
   * here so whoever fixes it has a test that changes colour when they do.
   */
  it('DOCUMENTS a pre-existing collision: a post slugged "admin" shares the admin key', () => {
    expect([...BLOG_KEY, 'admin']).toEqual(BLOG_ADMIN_KEY);
  });
});
