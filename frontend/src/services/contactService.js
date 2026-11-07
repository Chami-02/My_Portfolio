import api from './api';

// The route's own limit (contactController), which fits the 10 kb body limit.
const BULK_BATCH = 200;

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
  // PF-153: the owner's answer, sent by the server from the domain.
  reply: (id, message) => api.post(`/contact/${id}/reply`, { message }).then((r) => r.data.data),
  // PF-153: one batch after another, so a failure stops the rest.
  bulk: async (action, ids) => {
    for (let start = 0; start < ids.length; start += BULK_BATCH) {
      await api.post('/contact/bulk', { action, ids: ids.slice(start, start + BULK_BATCH) });
    }
  },
};