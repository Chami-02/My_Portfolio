import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vocabularyService } from '../services/vocabularyService';
import { BLOG_KEY, BLOG_ADMIN_KEY } from './useBlog';

export const VOCAB_KEY = ['vocabulary'];

export const vocabKey = (type) => [...VOCAB_KEY, type];

/**
 * A vocabulary list — the whole pool, or only its in-use half.
 *
 * ⚠️ THE TWO VARIANTS MUST NOT SHARE A CACHE KEY, and that is the entire
 * reason `inUse` reaches the key rather than only the request. They return
 * genuinely different lists from the same URL path: the admin picker
 * (PF-97) needs every tag so a new one can be picked before any post carries
 * it, while /blog's chip row (PF-98) needs only tags on a published post.
 * One key for both means whichever mounted first decides what the other
 * sees — the admin picker silently losing its unused tags, or /blog growing
 * chips that match nothing.
 *
 * The key stays THREE elements so it cannot collide with
 * `useVocabularyImpact`'s four (`[...vocabKey(type), 'impact', id]`).
 */
export const useVocabulary = (type, { inUse = false } = {}) =>
  useQuery({
    queryKey: [...vocabKey(type), { inUse }],
    queryFn:  () => vocabularyService.list(type, { inUse }),
    enabled:  !!type,
  });

/**
 * How much damage would deleting this item do?
 *
 * Returns `{ value, type, affected, label }` — `affected` is the number of
 * documents that currently carry the value, counted server-side at the
 * moment the dialog opens.
 *
 * Gated on `id` so it fires only while a confirm dialog is actually open.
 * A list of chips must not send one impact request per chip on render — the
 * endpoint is protected and the backend rate-limits at 100 req/15 min/IP,
 * which twelve chips would eat into for no reason.
 */
export const useVocabularyImpact = (type, id) =>
  useQuery({
    queryKey: [...vocabKey(type), 'impact', id],
    queryFn:  () => vocabularyService.impact(type, id),
    enabled:  !!type && !!id,
  });

export const useCreateVocabulary = (type) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (value) => vocabularyService.create(type, value),
    onSuccess:  () => qc.invalidateQueries({ queryKey: vocabKey(type) }),
  });
};

/**
 * Delete a vocabulary item.
 *
 * ⚠️ This is a CASCADING delete — the server strips the value from every
 * document that carries it. So the content caches are invalidated too, not
 * just the chip list. Invalidating only the vocabulary would leave the admin
 * list and the public site rendering tags that no longer exist in the
 * database, and the staleness would survive until an unrelated refetch —
 * the kind of bug that looks like "the delete didn't work" hours later.
 *
 * The blog keys are invalidated for `tag`; `tech` would need the project
 * keys, and deliberately does not get them here because nothing calls this
 * with 'tech' yet. Wiring a cache invalidation for a caller that does not
 * exist is how an untested branch ships.
 */
export const useDeleteVocabulary = (type) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => vocabularyService.remove(type, id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: vocabKey(type) });
      if (type === 'tag') {
        qc.invalidateQueries({ queryKey: BLOG_KEY });
        qc.invalidateQueries({ queryKey: BLOG_ADMIN_KEY });
      }
    },
  });
};
