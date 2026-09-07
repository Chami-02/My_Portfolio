import api from './api';

// PF-97 — the client for /api/vocabulary, built by PF-61/PF-62 in Sprint 9
// and left with ZERO frontend consumers until now. Endpoint shapes are
// transcribed from backend/src/controllers/vocabularyController.js rather
// than assumed.
//
// `type` is 'tag' (blog posts) or 'tech' (projects). Only 'tag' has a
// consumer today; the parameter is not speculative surface — it is in the
// route path, so the function cannot avoid taking it.
export const vocabularyService = {
  // Public — the picker loads without auth, deliberately, so the same list
  // can back a public filter. PF-98 is that later: /blog's chip row.
  //
  // ⚠️ `inUse` is the whole reason this signature grew. Omitted, the endpoint
  // returns the FULL pool, and the admin picker depends on that — a tag has
  // to be pickable before any post carries it, or a newly created tag could
  // never reach a first post. Passed as true, it returns only values carried
  // by at least one PUBLISHED post, which is what /blog's chips must be: a
  // pool value with no published post behind it renders a chip guaranteed to
  // return "no posts found", and a visitor cannot tell that from a broken
  // site.
  //
  // The backend compares against the literal string `'true'`
  // (vocabularyController.js), so the boolean is converted here rather than
  // relying on axios's serialisation of `true`.
  list: (type, { inUse = false } = {}) =>
    api
      .get(`/vocabulary/${type}`, { params: inUse ? { inUse: 'true' } : undefined })
      .then((r) => r.data.data),

  // Protected. Returns { value, type, affected, label } — `affected` is how
  // many documents currently carry this value, which is what the confirm
  // dialog needs before offering a destructive delete.
  impact: (type, id) =>
    api.get(`/vocabulary/${type}/${id}/impact`).then((r) => r.data.data),

  // Protected. 409 if the value already exists in this vocabulary.
  create: (type, value) =>
    api.post(`/vocabulary/${type}`, { value }).then((r) => r.data.data),

  // ⚠️ Protected and CASCADING. This does not merely remove the chip from a
  // picker — the controller `$pull`s the value from every matching document
  // first (`updateMany`, in a transaction where the topology supports one).
  // Returns { deleted, strippedFrom, label, transactional }.
  //
  // Callers MUST invalidate the affected content's query cache, not just the
  // vocabulary list: blog posts really did change.
  remove: (type, id) =>
    api.delete(`/vocabulary/${type}/${id}`).then((r) => r.data.data),
};
