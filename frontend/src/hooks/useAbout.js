import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aboutService } from '../services/aboutService';

export const ABOUT_KEY = ['about'];

export const useAbout = () =>
  useQuery({ queryKey: ABOUT_KEY, queryFn: aboutService.get });

export const useUpdateAbout = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: aboutService.update,
    onSuccess: () => qc.invalidateQueries({ queryKey: ABOUT_KEY }),
  });
};

export const useToggleAvailability = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: aboutService.toggleAvailability,
    onSuccess: () => qc.invalidateQueries({ queryKey: ABOUT_KEY }),
  });
};