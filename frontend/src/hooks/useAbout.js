import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aboutService } from '../services/aboutService';

export const ABOUT_KEY = ['about'];

export const useAbout = () =>
  useQuery({ queryKey: ABOUT_KEY, queryFn: aboutService.get });

// ── Why every mutation here invalidates ABOUT_KEY and NOTHING else ──────────
// The media routes return only their own slice — { avatar, hasAvatar, … } and
// { resume, hasResume, … }, never the whole About document — so writing the
// response into the cache would replace a full profile with a fragment.
// Invalidating and letting the query refetch is both correct and one request.
//
// ⚠️ DELIBERATELY NOT DASHBOARD_KEY. The contract in useDashboardStats.js is
// "every mutation that can change a COUNT", and the seven fields it serves are
// projects, skills, posts, published, drafts, messages and unread. An About
// save changes none of them, so an invalidation here would be the same
// unnecessary refetch that useDashboardStats.test.jsx pins as a NEGATIVE for
// useUpdateProject.
const invalidateAbout = (qc) => () => qc.invalidateQueries({ queryKey: ABOUT_KEY });

export const useUpdateAbout = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: aboutService.update,
    onSuccess:  invalidateAbout(qc),
  });
};

// ── PF-112: the portrait and the résumé ─────────────────────────────────────
// ⚠️ These are the COMMIT half of a staged form. The panel holds a picked File
// in component state and calls them only from SAVE PROFILE, so that nothing
// reaches Cloudinary — or the public site — until the owner asks for it. A
// caller that fires one of these on a file-pick change event breaks that
// contract silently: everything still works, it just publishes too early.
export const useUploadAvatar = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: aboutService.uploadAvatar, onSuccess: invalidateAbout(qc) });
};

export const useRemoveAvatar = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: aboutService.removeAvatar, onSuccess: invalidateAbout(qc) });
};

export const useUploadResume = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: aboutService.uploadResume, onSuccess: invalidateAbout(qc) });
};

export const useRemoveResume = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: aboutService.removeResume, onSuccess: invalidateAbout(qc) });
};

// ── `useToggleAvailability` was DELETED here in PF-112 ──────────────────────
// Availability is now staged with the rest of the About form and committed by
// the same PUT /api/about, so the PATCH /api/about/availability client had zero
// consumers the moment the panel was rewritten. Left in place it would have
// kept passing its own coverage — the documented case where a green suite
// reports unreachable code as alive.
//
// The BACKEND route is untouched: it has three passing tests
// (backend/src/__tests__/about.test.js) and is a reasonable API affordance. It
// simply has no caller now, which is PF-120's call, not this ticket's.
