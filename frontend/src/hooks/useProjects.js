import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { projectService } from '../services/projectService';
import { refreshDashboard } from './useDashboardStats';

// Query key constant — always use this, never a raw string
// TanStack uses these keys to identify and invalidate cached data
export const PROJECTS_KEY = ['projects'];

// PF-113 — the admin's list, drafts included. A CHILD of PROJECTS_KEY on
// purpose: TanStack matches invalidation by prefix, so every mutation below
// that invalidates PROJECTS_KEY refreshes this list too, and nothing has to
// remember a second line. It must never SHARE the public key — the public
// section would then render drafts whenever the admin had loaded first.
export const PROJECTS_ADMIN_KEY = [...PROJECTS_KEY, 'admin'];

// ── Read ─────────────────────────────────────────────────────────────────────

/**
 * The public list's query params, normalised — useBlog's `blogListParams`
 * rule (PF-98), for the same reason: the object IS the query key, so `{}`,
 * `{ q: '  ' }` and `{ tech: 'All' }` must be ONE key. That is what lets
 * /projects mount the filtered list AND an unfiltered one for its count —
 * and the home section share that unfiltered one — with a single request
 * while no filter is active. Mirrors backend/src/utils/projectQuery.js.
 */
export const projectListParams = ({ q, tech, category } = {}) => {
  const params = {};
  const query = typeof q === 'string' ? q.trim() : '';
  if (query) params.q = query;

  const values = (input) => (Array.isArray(input) ? input : [input])
    .filter((v) => typeof v === 'string')
    .map((v) => v.trim())
    .filter((v) => v && v.toLowerCase() !== 'all');

  // Sorted COPY: one key whatever order the chips were clicked in, and the
  // caller's own array (searchParams.getAll) is never reordered.
  const techs = values(tech);
  if (techs.length) params.tech = [...techs].sort();
  const [first] = values(category);
  if (first) params.category = first;
  return params;
};

/**
 * Published projects, optionally filtered by `{ q, tech, category }`.
 *
 * PF-144: keyed `['projects', 'list', params]` — under PROJECTS_KEY, so every
 * mutation's prefix invalidation still reaches it, and in its own segment so
 * no project slug (`/projects/admin`…) can ever collide with a list key (the
 * Blog lesson of 2026-10-14). `keepPreviousData` keeps the grid on screen
 * between keystrokes.
 */
export const useProjects = (params) => {
  const listParams = projectListParams(params);
  return useQuery({
    queryKey:        [...PROJECTS_KEY, 'list', listParams],
    queryFn:         () => projectService.getAll(listParams),
    placeholderData: keepPreviousData,
  });
};

/** PF-144 — one published project's page: `{ project, prev, next, index, total }`. */
export const useProject = (slug) =>
  useQuery({
    queryKey: [...PROJECTS_KEY, 'page', slug],
    queryFn:  () => projectService.getBySlug(slug),
    enabled:  !!slug,
  });

/** Every project, drafts included — the admin panel's list (PF-113). */
export const useAdminProjects = () =>
  useQuery({
    queryKey: PROJECTS_ADMIN_KEY,
    queryFn:  projectService.getAllAdmin,
  });

// ── Write (Mutations) ─────────────────────────────────────────────────────────

/** Create a new project — used in admin panel */
export const useCreateProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: projectService.create,
    onSuccess: () => {
      // After creating, invalidate the projects list so it re-fetches
      qc.invalidateQueries({ queryKey: PROJECTS_KEY });
      // PF-110: the admin's project count lives in one shared stats entry.
      refreshDashboard(qc);
    },
  });
};

/** Update an existing project — used in admin panel.
 *  Deliberately does NOT invalidate DASHBOARD_KEY: an update cannot change
 *  how many projects there are, and that count is all the stats carry. */
export const useUpdateProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => projectService.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
};

/**
 * PF-144 — upload one section picture into the project's ledger. Invalidates
 * nothing: a ledger entry is shown nowhere until the save that names it, and
 * that save invalidates PROJECTS_KEY itself.
 */
export const useUploadSectionImage = () =>
  useMutation({ mutationFn: ({ id, file }) => projectService.uploadSectionImage(id, file) });

/** Delete a project — used in admin panel */
export const useDeleteProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: projectService.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROJECTS_KEY });
      refreshDashboard(qc);
    },
  });
};
// ── Card background, PF-113 ──────────────────────────────────────────────────
// Neither route's response is a bare project in the list's shape, so these
// invalidate rather than write into the cache. No DASHBOARD_KEY: a background
// changes no count.

/** Upload (or replace) a project's card background. */
export const useUploadBackground = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }) => projectService.uploadBackground(id, file),
    onSuccess:  () => qc.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
};

/** Clear a project's card background; the server destroys the file. */
export const useRemoveBackground = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => projectService.removeBackground(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
};
