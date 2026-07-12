import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { blogService } from '../services/blogService';

export const BLOG_KEY       = ['blog'];
export const BLOG_ADMIN_KEY = ['blog', 'admin'];

export const useBlogPosts     = () =>
  useQuery({ queryKey: BLOG_KEY, queryFn: blogService.getPublished });

export const useBlogPostAdmin = () =>
  useQuery({ queryKey: BLOG_ADMIN_KEY, queryFn: blogService.getAllAdmin });

export const useBlogPost = (slug) =>
  useQuery({
    queryKey: [...BLOG_KEY, slug],
    queryFn:  () => blogService.getBySlug(slug),
    enabled:  !!slug,
  });

export const useCreatePost = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: blogService.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BLOG_KEY });
      qc.invalidateQueries({ queryKey: BLOG_ADMIN_KEY });
    },
  });
};

export const useUpdatePost = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => blogService.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BLOG_KEY });
      qc.invalidateQueries({ queryKey: BLOG_ADMIN_KEY });
    },
  });
};

export const useTogglePublish = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: blogService.togglePublish,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BLOG_KEY });
      qc.invalidateQueries({ queryKey: BLOG_ADMIN_KEY });
    },
  });
};

export const useDeletePost = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: blogService.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BLOG_KEY });
      qc.invalidateQueries({ queryKey: BLOG_ADMIN_KEY });
    },
  });
};