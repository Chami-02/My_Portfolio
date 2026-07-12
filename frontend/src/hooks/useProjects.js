import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectService } from '../services/projectService';

// Query key constant — always use this, never a raw string
// TanStack uses these keys to identify and invalidate cached data
export const PROJECTS_KEY = ['projects'];

// ── Read ─────────────────────────────────────────────────────────────────────

/** Fetch all projects from the API */
export const useProjects = () =>
  useQuery({
    queryKey: PROJECTS_KEY,
    queryFn:  projectService.getAll,
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
    },
  });
};

/** Update an existing project — used in admin panel */
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
    onSuccess: () => qc.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
};