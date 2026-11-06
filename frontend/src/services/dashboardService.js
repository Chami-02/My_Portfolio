import api from './api';

// PF-110. Admin protected — the seven counts behind the Overview cards, the
// sidebar badges and the footer's session column, in one request.
export const dashboardService = {
  getStats: () => api.get('/dashboard/stats').then((r) => r.data.data),

  // PF-149 — the Analytics panel. ⚠️ `audience` in the address, never `analytics`:
  // ad blockers' lists target that word, and the panel would simply fail.
  getAnalytics: (range) =>
    api.get('/dashboard/audience', { params: { range } }).then((r) => r.data.data),
  getGrowth: () => api.get('/dashboard/audience/growth').then((r) => r.data.data),
  getLive:   () => api.get('/dashboard/audience/live').then((r) => r.data.data),
  exportCsv: () =>
    api.get('/dashboard/audience/export', { responseType: 'blob' }).then((r) => r.data),
};
