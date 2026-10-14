import api from './api';

export const contactService = {
  // Public
  submit: (data) => api.post('/contact', data).then((r) => r.data),

  // Admin protected
  getAll:    ()    => api.get('/contact').then((r) => r.data.data),
  // Read or unread — an explicit value, never a flip (same rule as the star).
  markRead:  (id, read = true) => api.patch(`/contact/${id}/read`, { read }).then((r) => r.data.data),
  // PF-115: an explicit value, never a flip — see contactController.setStarred.
  star:      (id, starred) => api.patch(`/contact/${id}/star`, { starred }).then((r) => r.data.data),
  remove:    (id)  => api.delete(`/contact/${id}`),
};