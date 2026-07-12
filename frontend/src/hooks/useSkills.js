import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { skillService } from '../services/skillService';

export const SKILLS_KEY = ['skills'];

export const useSkills = () =>
  useQuery({ queryKey: SKILLS_KEY, queryFn: skillService.getAll });

export const useCreateSkill = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: skillService.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: SKILLS_KEY }),
  });
};

export const useDeleteSkill = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: skillService.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: SKILLS_KEY }),
  });
};