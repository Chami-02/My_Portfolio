import api from './api';
import { multipart } from './multipart';

/**
 * PF-143 — the API of an ordered list of owner-written entries (Education,
 * Certificates; backend `controllers/entryController.js`). `media` is the
 * picture's route segment — each media field has its own route (locked).
 */
const makeEntryService = (base, media) => ({
  getAll:      ()         => api.get(base).then((r) => r.data.data),
  getAllAdmin: ()         => api.get(`${base}/admin/all`).then((r) => r.data.data),
  create:      (data)     => api.post(base, data).then((r) => r.data.data),
  update:      (id, data) => api.put(`${base}/${id}`, data).then((r) => r.data.data),
  remove:      (id)       => api.delete(`${base}/${id}`),
  reorder:     (ids)      => api.put(`${base}/reorder`, { ids }).then((r) => r.data.data),
  uploadPicture: (id, file) =>
    api.put(`${base}/${id}/${media}`, ...multipart(file)).then((r) => r.data.data),
  removePicture: (id) => api.delete(`${base}/${id}/${media}`).then((r) => r.data.data),
});

export const certificateService = makeEntryService('/certificates', 'image');
export const educationService   = makeEntryService('/education', 'logo');
