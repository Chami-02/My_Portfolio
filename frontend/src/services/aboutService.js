import api from './api';
import { multipart } from './multipart';

// The multipart helper moved to ./multipart.js in PF-113, when the project
// background became its second caller. Read its comment before touching it.
export const aboutService = {
  get:    ()     => api.get('/about').then((r) => r.data.data),
  update: (data) => api.put('/about', data).then((r) => r.data.data),

  // ── Media, PF-112 ───────────────────────────────────────────────────────
  // Each of these is a DEDICATED route that uploads, saves and destroys the
  // previous Cloudinary file inside one handler (PF-111). The client never
  // names a publicId, which is why a destructive delete cannot be aimed.
  //
  // ⚠️ None of them returns the whole About document — the payloads are
  // { avatar, hasAvatar, replaced, oldDeleted } and { resume, hasResume,
  // replaced, oldDeleted } — so the hooks invalidate ABOUT_KEY
  // rather than writing the response into the cache.
  uploadAvatar: (file) => api.put('/about/avatar', ...multipart(file)).then((r) => r.data.data),
  removeAvatar: ()     => api.delete('/about/avatar').then((r) => r.data.data),
  uploadResume: (file) => api.put('/about/resume', ...multipart(file)).then((r) => r.data.data),
  removeResume: ()     => api.delete('/about/resume').then((r) => r.data.data),
};
