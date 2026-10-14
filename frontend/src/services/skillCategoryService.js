import api from './api';

// PF-114 — owner-managed Skills sections.
export const skillCategoryService = {
  getAll:  ()            => api.get('/skill-categories').then((r) => r.data.data),
  create:  (label)       => api.post('/skill-categories', { label }).then((r) => r.data.data),
  rename:  (id, label)   => api.put(`/skill-categories/${id}`, { label }).then((r) => r.data.data),
  reorder: (ids)         => api.put('/skill-categories/reorder', { ids }).then((r) => r.data.data),
  // `choice` is {} (empty section), { moveTo: id } or { deleteSkills: true }.
  // axios sends a DELETE body only through `data`.
  remove:  (id, choice = {}) => api.delete(`/skill-categories/${id}`, { data: choice }).then((r) => r.data.data),
};
