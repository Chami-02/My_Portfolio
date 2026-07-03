import api from './api';

export const blogService = {
  // Public
  getPublished: ()      => api.get('/blog').then((r) => r.data.data),
  getBySlug:    (slug)  => api.get(`/blog/${slug}`).then((r) => r.data.data),

  // Admin protected
  getAllAdmin:   ()      => api.get('/blog/admin/all').then((r) => r.data.data),
  create:       (data)  => api.post('/blog', data).then((r) => r.data.data),
  update:       (id, data) => api.put(`/blog/${id}`, data).then((r) => r.data.data),
  togglePublish:(id)    => api.patch(`/blog/${id}/publish`).then((r) => r.data),
  remove:       (id)    => api.delete(`/blog/${id}`),
};