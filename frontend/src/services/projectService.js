import api from './api';

export const projectService = {
  // Public
  getAll:   ()           => api.get('/projects').then((r) => r.data.data),
  getById:  (id)         => api.get(`/projects/${id}`).then((r) => r.data.data),

  // Admin protected
  create:   (data)       => api.post('/projects', data).then((r) => r.data.data),
  update:   (id, data)   => api.put(`/projects/${id}`, data).then((r) => r.data.data),
  remove:   (id)         => api.delete(`/projects/${id}`),
};