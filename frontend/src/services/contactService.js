import api from './api';

export const contactService = {
  // Public
  submit: (data) => api.post('/contact', data).then((r) => r.data),

  // Admin protected
  getAll:    ()    => api.get('/contact').then((r) => r.data.data),
  markRead:  (id)  => api.patch(`/contact/${id}/read`).then((r) => r.data.data),
  remove:    (id)  => api.delete(`/contact/${id}`),
};