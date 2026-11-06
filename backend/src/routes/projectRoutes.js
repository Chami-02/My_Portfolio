const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { publicCache } = require('../middleware/cache'); // PF-128
const { longJson } = require('../middleware/bodyParsers');
const { uploadSingle } = require('../middleware/upload');
const {
  getAllProjects,
  getProjectBySlug,
  getAllProjectsAdmin,
  createProject,
  updateProject,
  deleteProject,
  uploadBackground,
  removeBackground,
  uploadSectionImage,
} = require('../controllers/projectController');

router.get('/',    publicCache, getAllProjects);
// PF-113 — drafts included.
router.get('/admin/all', protect, getAllProjectsAdmin);
// PF-144 — a project's own page. By SLUG: the public GET /:id went on
// 2026-11-02. `/admin/all` is two segments, so `/:slug` cannot capture it.
router.get('/:slug', publicCache, getProjectBySlug);
router.post('/',      protect, longJson, createProject);   
router.put('/:id',    protect, longJson, updateProject);
router.delete('/:id', protect, deleteProject);

// ── NEW IN PF-111 ────────────────────────────────────────────
// `protect` runs BEFORE `uploadSingle`, copying the reasoning already
// written in aboutRoutes.js: an anonymous request is rejected on its
// headers, so a stranger cannot make the server buffer megabytes into
// memory before finding out they have no token. Reversing these two is
// a free denial-of-service.
router.put('/:id/background',    protect, uploadSingle, uploadBackground);
router.delete('/:id/background', protect, removeBackground);
// PF-144 — a section picture into the project's ledger. `protect` before
// multer, for the same reason as above.
router.post('/:id/images',       protect, uploadSingle, uploadSectionImage);
// ─────────────────────────────────────────────────────────────

module.exports = router;