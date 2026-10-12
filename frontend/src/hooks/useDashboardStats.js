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
 * ⚠️ Every mutation that can change a count calls `refreshDashboard(qc)` —
 * create/delete on projects and skills, create/update/togglePublish/delete
 * on posts, markRead/delete on messages. The list is explicit, hook by
 * hook, the same way each hook already lists its own keys; a new mutation
 * that adds or removes a document must add the line or the badges go
 * stale for staleTime (5 min).
 */
export const DASHBOARD_KEY = ['dashboard', 'stats'];

/**
 * PF-118 — what every count-changing mutation calls instead of a bare
 * `invalidateQueries({ queryKey: DASHBOARD_KEY })`.
 *
 * ⚠️ CANCEL FIRST, because a bare invalidation can be SWALLOWED. TanStack v5
 * only cancels an in-flight fetch on refetch when the query already HAS data;
 * during the shell's FIRST stats fetch it has none, so the invalidation is
 * deduped into that request — whose answer predates the save — and the badges
 * stay wrong for staleTime (5 min). Reproduced against a real QueryClient
 * 2026-10-12: one fetch, stale value. Cancelling first reverts the query to its
 * pre-fetch state, so the invalidation starts a NEW request: two fetches, the
 * fresh value wins, status stays `success`. Measured live in PF-115: a draft
 * saved ~1 s after login read `0 DRAFT`.
 *
 * Sequenced, not two statements: the cancellation settles asynchronously, and
 * an invalidation issued before it has would find the cancelled request still
 * in flight and dedupe into it all the same.
 */
export const refreshDashboard = (qc) =>
  qc.cancelQueries({ queryKey: DASHBOARD_KEY })
    .then(() => qc.invalidateQueries({ queryKey: DASHBOARD_KEY }));

export const useDashboardStats = () =>
  useQuery({ queryKey: DASHBOARD_KEY, queryFn: dashboardService.getStats });
