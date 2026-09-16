import api from './api';

// PF-110. Admin protected — the seven counts behind the Overview cards, the
// sidebar badges and the footer's session column, in one request.
export const dashboardService = {
  getStats: () => api.get('/dashboard/stats').then((r) => r.data.data),
};
