import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { certificateService, educationService } from '../services/entryService';
import { refreshDashboard } from './useDashboardStats';

/**
 * PF-143 — the queries and mutations of one entry list. Every write
 * invalidates the list's key, which covers the admin list (`[...key,
 * 'admin']`) by prefix; the two that change a COUNT also refresh the
 * dashboard through `refreshDashboard` (never a bare invalidate — locked).
 */
const makeEntryHooks = (key, service) => {
  const useWrite = (mutationFn, { counts = false } = {}) => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn,
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: key });
        if (counts) refreshDashboard(qc);
      },
    });
  };

  return {
    usePublic: () => useQuery({ queryKey: key, queryFn: service.getAll }),
    useAdmin:  () => useQuery({ queryKey: [...key, 'admin'], queryFn: service.getAllAdmin }),
    useCreate: () => useWrite(service.create, { counts: true }),
    useUpdate: () => useWrite(({ id, data }) => service.update(id, data)),
    useRemove: () => useWrite(service.remove, { counts: true }),
    useReorder: () => useWrite(service.reorder),
    useUploadPicture: () => useWrite(({ id, file }) => service.uploadPicture(id, file)),
    useRemovePicture: () => useWrite(service.removePicture),
  };
};

export const certificateHooks = makeEntryHooks(['certificates'], certificateService);
export const educationHooks   = makeEntryHooks(['education'], educationService);

export const useCertificates = certificateHooks.usePublic;
export const useEducation    = educationHooks.usePublic;
