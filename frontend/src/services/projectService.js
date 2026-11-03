import api from './api';
import { multipart } from './multipart';

export const projectService = {
  // Public — PUBLISHED projects only since PF-113; drafts never leave the server.
  // PF-144: `{ q, tech, category }` narrow it (/projects' search).
  getAll:   (params)     => api.get('/projects', { params }).then((r) => r.data.data),

  // PF-144 — one project's page. A COMPOUND resource, Blog's getBySlug shape:
  // `{ project, prev, next, index, total }`.
  getBySlug: (slug)      => api.get(`/projects/${encodeURIComponent(slug)}`).then((r) => r.data.data),

  // Admin protected
  // PF-113: every project, drafts included — the admin panel's list.
  getAllAdmin: ()        => api.get('/projects/admin/all').then((r) => r.data.data),
  create:   (data)       => api.post('/projects', data).then((r) => r.data.data),
  update:   (id, data)   => api.put(`/projects/${id}`, data).then((r) => r.data.data),
  remove:   (id)         => api.delete(`/projects/${id}`),

  // ── Card background, PF-113 (routes built by PF-111) ────────────────────
  // A DEDICATED route uploads, saves and destroys the previous Cloudinary file
  // in one handler; the client never names a publicId. Returns
  // { project, replaced, oldDeleted } / { project, removed, deleted }.
  uploadBackground: (id, file) =>
    api.put(`/projects/${id}/background`, ...multipart(file)).then((r) => r.data.data),
  removeBackground: (id) =>
    api.delete(`/projects/${id}/background`).then((r) => r.data.data),

  // PF-144 — one section picture into the project's ledger. Returns the
  // ledger entry `{ publicId, url, width, height }`; a save then names it.
  uploadSectionImage: (id, file) =>
    api.post(`/projects/${id}/images`, ...multipart(file)).then((r) => r.data.data),
};
