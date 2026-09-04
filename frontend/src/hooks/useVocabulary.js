import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vocabularyService } from '../services/vocabularyService';
import { BLOG_KEY, BLOG_ADMIN_KEY } from './useBlog';

export const VOCAB_KEY = ['vocabulary'];

export const vocabKey = (type) => [...VOCAB_KEY, type];

export const useVocabulary = (type) =>
  useQuery({
    queryKey: vocabKey(type),
    queryFn:  () => vocabularyService.list(type),
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
