import api from './api';

export const aboutService = {
  get:                ()      => api.get('/about').then((r) => r.data.data),
  update:             (data)  => api.put('/about', data).then((r) => r.data.data),
  toggleAvailability: ()      => api.patch('/about/availability').then((r) => r.data),
};