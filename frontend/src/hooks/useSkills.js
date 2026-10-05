import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { skillService } from '../services/skillService';
import { DASHBOARD_KEY } from './useDashboardStats';

export const SKILLS_KEY = ['skills'];

export const useSkills = () =>
  useQuery({ queryKey: SKILLS_KEY, queryFn: skillService.getAll });

export const useCreateSkill = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: skillService.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SKILLS_KEY });
      // PF-110: the admin's skill count lives in one shared stats entry.
      qc.invalidateQueries({ queryKey: DASHBOARD_KEY });
    },
  });
};

export const useDeleteSkill = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: skillService.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SKILLS_KEY });
      qc.invalidateQueries({ queryKey: DASHBOARD_KEY });
    },
  });
};
// PF-114 — the first caller of skillService.update, which had none.
// ⚠️ SKILLS_KEY only, NOT DASHBOARD_KEY: an edit changes no count, so a stats
// refetch would be a wasted request (pinned in useDashboardStats.test.jsx).
export const useUpdateSkill = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => skillService.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: SKILLS_KEY }),
  });
};

// PF-114 — one card's new order. Same reasoning: no count changes.
export const useReorderSkills = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: skillService.reorder,
    onSuccess: () => qc.invalidateQueries({ queryKey: SKILLS_KEY }),
  });
};
