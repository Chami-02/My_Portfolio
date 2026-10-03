import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectService } from '../services/projectService';
import { DASHBOARD_KEY } from './useDashboardStats';

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

/** Fetch all projects from the API */
export const useProjects = () =>
  useQuery({
    queryKey: PROJECTS_KEY,
    queryFn:  projectService.getAll,
  });

/** Every project, drafts included — the admin panel's list (PF-113). */
export const useAdminProjects = () =>
  useQuery({
    queryKey: PROJECTS_ADMIN_KEY,
    queryFn:  projectService.getAllAdmin,
  });

/** Fetch a single project by ID */
export const useProject = (id) =>
  useQuery({
    queryKey: [...PROJECTS_KEY, id],
    queryFn:  () => projectService.getById(id),
    enabled:  !!id,   // Don't run if id is null/undefined
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
      qc.invalidateQueries({ queryKey: DASHBOARD_KEY });
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

/** Delete a project — used in admin panel */
export const useDeleteProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: projectService.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROJECTS_KEY });
      qc.invalidateQueries({ queryKey: DASHBOARD_KEY });
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
