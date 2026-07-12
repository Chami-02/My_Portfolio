import api from './api';

export const skillService = {
  getAll:  ()           => api.get('/skills').then((r) => r.data.data),
  create:  (data)       => api.post('/skills', data).then((r) => r.data.data),
  update:  (id, data)   => api.put(`/skills/${id}`, data).then((r) => r.data.data),
  remove:  (id)         => api.delete(`/skills/${id}`),
};