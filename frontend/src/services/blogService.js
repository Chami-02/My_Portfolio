import api from './api';

export const blogService = {
  // Public.
  //
  // ⚠️ `params` reaches a backend that has supported `?q=` and `?tag=` since
  // PF-96 and had ZERO callers until PF-98. Semantics are the server's, in
  // backend/src/utils/blogQuery.js `buildMatch`, and are not re-implemented
  // here: `q` is a case-insensitive substring over title, excerpt and tags
  // ONLY (never section bodies), `tag` is an anchored case-insensitive exact
  // match, the two combine with AND, and `'All'` in any casing means no
  // filter at all.
  //
  // The caller passes an already-normalised object (hooks/useBlog.js's
  // `blogListParams`), so an empty `q` or a `tag` of `'All'` never reaches
  // the wire — axios omits `undefined`, not `''`, and a stray `?q=` would
  // make the URL differ from the cache key that produced it.
  //
  // ⚠️ The response is ordered by the server — `$ifNull: [publishedAt,
  // createdAt]` descending, `_id` ascending — so `data[0]` is already the
  // newest post. Do NOT re-sort it on the client.
  getPublished: (params) =>
    api.get('/blog', { params }).then((r) => r.data.data),

  // ⚠️ Returns a COMPOUND resource, not a bare post — PF-96 shaped it as
  // `{ post, prev, next }` and PF-99 added `{ index, total }` for the
  // reading view's `01 ·` numeral. The name says "get by slug" and the
  // payload is four more things than that, so every caller destructures.
  getBySlug:    (slug)  => api.get(`/blog/${slug}`).then((r) => r.data.data),

  // ── PF-99 ────────────────────────────────────────────────────────────
  // The view counter. `PATCH /blog/:slug/view` has existed since PF-64
  // with ZERO callers, which is the only reason every post's count has
  // been 0 — the endpoint, the `$inc`, the 30/min limiter and the schema
  // field were all already there and working.
  //
  // Public and unauthenticated by design: it is the reader who is
  // counted, not an admin.
  recordView:   (slug)  => api.patch(`/blog/${slug}/view`).then((r) => r.data.data),

  // Admin protected
  getAllAdmin:   ()      => api.get('/blog/admin/all').then((r) => r.data.data),
  create:       (data)  => api.post('/blog', data).then((r) => r.data.data),
  update:       (id, data) => api.put(`/blog/${id}`, data).then((r) => r.data.data),
  togglePublish:(id)    => api.patch(`/blog/${id}/publish`).then((r) => r.data),
  remove:       (id)    => api.delete(`/blog/${id}`),
};
