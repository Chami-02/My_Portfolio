import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { blogService } from '../services/blogService';

export const BLOG_KEY       = ['blog'];
export const BLOG_ADMIN_KEY = ['blog', 'admin'];

/**
 * The public list's query params, normalised — PF-98.
 *
 * ⚠️ THIS FUNCTION'S JOB IS CACHE IDENTITY, not tidiness. It is what makes
 * `{ q: '', tag: 'All' }` and `{}` produce the SAME key, and that single
 * property is what lets /blog mount two list queries — the filtered one it
 * renders and an unfiltered one for the design's `N POSTS · ALL TOPICS`
 * count — and still issue exactly ONE request while no filter is active.
 * Lose it and every visit to /blog costs two identical round trips against a
 * backend that rate-limits at 100 req / 15 min / IP.
 *
 * The rules mirror `buildMatch` in backend/src/utils/blogQuery.js rather than
 * inventing their own: trim, drop an empty query, and treat `'All'` in any
 * casing as no filter. Mirroring matters because a param the server would
 * ignore must not reach the key either — otherwise two keys map to one
 * response and the cache stores it twice.
 */
export const blogListParams = ({ q, tag } = {}) => {
  const params = {};

  const query = typeof q === 'string' ? q.trim() : '';
  if (query) params.q = query;

  // ── ⚠️ MULTI-TAG SINCE PF-105 ────────────────────────────────────────
  // `tag` is a string for one and an array for several. Normalised to an
  // array here so the service, the query key and the server see one shape.
  const tags = (Array.isArray(tag) ? tag : [tag])
    .filter((t) => typeof t === 'string')
    .map((t) => t.trim())
    .filter((t) => t && t.toLowerCase() !== 'all');

  // ⚠️ SORTED, and that is not cosmetic. This object IS the React Query
  // key (`[...BLOG_KEY, 'list', listParams]`), so ['Docker','DevOps'] and
  // ['DevOps','Docker'] would be two cache entries for one identical
  // result set — the same list fetched twice depending on the order the
  // chips happened to be clicked in. Sorting collapses them to one.
  //
  // A COPY, not an in-place sort: `tag` may be the caller's own array — on
  // /blog it is `searchParams.getAll('tag')` — and sorting it in place
  // would reorder the caller's data as a side effect of building params.
  if (tags.length) params.tag = [...tags].sort();

  return params;
};

/**
 * The public post list, optionally filtered by `{ q, tag }`.
 *
 * ⚠️ The key gained a `'list'` segment in PF-98 and the reason is collision,
 * not neatness. `useBlogPost(slug)` keys on `['blog', <slug>]`, so a
 * two-element key of `['blog', <params>]` would sit in the same namespace as
 * every post detail. Three elements keeps the list in its own space while
 * `BLOG_KEY` (`['blog']`) still prefix-matches it, so every existing mutation
 * invalidates the list exactly as it did before.
 *
 * ⚠️ Found while tracing that, NOT fixed here and reported to Outstanding
 * work: `BLOG_ADMIN_KEY` is `['blog', 'admin']`, which is byte-identical to
 * the key `useBlogPost('admin')` produces. A post slugged `admin` would share
 * a cache entry with the admin list. Pre-existing, out of PF-98's scope, and
 * a genuine latent bug.
 *
 * `keepPreviousData` is what stops the grid blanking between keystrokes while
 * a new search resolves — the previous list stays on screen and `isLoading`
 * stays false, so the placeholder skeletons do not flash on every character.
 */
export const useBlogPosts = (params) => {
  const listParams = blogListParams(params);
  return useQuery({
    queryKey:        [...BLOG_KEY, 'list', listParams],
    queryFn:         () => blogService.getPublished(listParams),
    placeholderData: keepPreviousData,
  });
};

export const useBlogPostAdmin = () =>
  useQuery({ queryKey: BLOG_ADMIN_KEY, queryFn: blogService.getAllAdmin });

export const useBlogPost = (slug) =>
  useQuery({
    queryKey: [...BLOG_KEY, slug],
    queryFn:  () => blogService.getBySlug(slug),
    enabled:  !!slug,
  });

export const useCreatePost = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: blogService.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BLOG_KEY });
      qc.invalidateQueries({ queryKey: BLOG_ADMIN_KEY });
    },
  });
};

export const useUpdatePost = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => blogService.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BLOG_KEY });
      qc.invalidateQueries({ queryKey: BLOG_ADMIN_KEY });
    },
  });
};

export const useTogglePublish = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: blogService.togglePublish,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BLOG_KEY });
      qc.invalidateQueries({ queryKey: BLOG_ADMIN_KEY });
    },
  });
};

export const useDeletePost = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: blogService.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BLOG_KEY });
      qc.invalidateQueries({ queryKey: BLOG_ADMIN_KEY });
    },
  });
};