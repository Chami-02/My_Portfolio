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
  // can back a public filter later.
  list: (type) => api.get(`/vocabulary/${type}`).then((r) => r.data.data),

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
