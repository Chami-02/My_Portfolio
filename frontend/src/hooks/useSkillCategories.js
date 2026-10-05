import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { skillCategoryService } from '../services/skillCategoryService';
import { SKILLS_KEY } from './useSkills';
import { DASHBOARD_KEY } from './useDashboardStats';

// PF-114 — the owner-managed sections the Skills boxes are built from.
export const SKILL_CATEGORIES_KEY = ['skillCategories'];

export const useSkillCategories = () =>
  useQuery({ queryKey: SKILL_CATEGORIES_KEY, queryFn: skillCategoryService.getAll });

const useCategoryMutation = (mutationFn) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: SKILL_CATEGORIES_KEY }),
  });
};

// Create / rename / reorder touch only the section list — no skill moves and
// no count changes, so neither SKILLS_KEY nor DASHBOARD_KEY.
export const useCreateSkillCategory  = () => useCategoryMutation(skillCategoryService.create);
export const useRenameSkillCategory  = () =>
  useCategoryMutation(({ id, label }) => skillCategoryService.rename(id, label));
export const useReorderSkillCategories = () => useCategoryMutation(skillCategoryService.reorder);

// ⚠️ Delete can MOVE skills (their category changes) or DELETE them (the skill
// count changes), so it refreshes the skills and the dashboard counts too.
export const useDeleteSkillCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, choice }) => skillCategoryService.remove(id, choice),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SKILL_CATEGORIES_KEY });
      qc.invalidateQueries({ queryKey: SKILLS_KEY });
      qc.invalidateQueries({ queryKey: DASHBOARD_KEY });
    },
  });
};
