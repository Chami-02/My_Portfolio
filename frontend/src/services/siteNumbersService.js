import api from './api';

export const siteNumbersService = {
  get: () => api.get('/site-numbers').then((r) => r.data.data),
};
