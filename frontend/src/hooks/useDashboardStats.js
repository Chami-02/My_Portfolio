// frontend/src/hooks/useDashboardStats.js
import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../services/dashboardService';

/**
 * PF-110. `{ projects, skills, posts, published, drafts, messages, unread }`
 * from GET /api/dashboard/stats.
 *
 * Three consumers — AdminOverviewPanel, AdminLayout (badges + meta line)
 * and AdminFooter (session counts) — share this ONE cache entry. Before
 * this existed the shell derived the same seven integers from four full
 * list fetches, and the Overview panel from three more.
 *
 * ⚠️ Every mutation that can change a count invalidates DASHBOARD_KEY —
 * create/delete on projects and skills, create/update/togglePublish/delete
 * on posts, markRead/delete on messages. The list is explicit, hook by
 * hook, the same way each hook already lists its own keys; a new mutation
 * that adds or removes a document must add the line or the badges go
 * stale for staleTime (5 min).
 */
export const DASHBOARD_KEY = ['dashboard', 'stats'];

export const useDashboardStats = () =>
  useQuery({ queryKey: DASHBOARD_KEY, queryFn: dashboardService.getStats });
