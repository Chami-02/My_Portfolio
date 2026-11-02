const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { publicCache } = require('../middleware/cache'); // PF-128
const { uploadSingle } = require('../middleware/upload');
const {
  getAllProjects,
  getAllProjectsAdmin,
  createProject,
  updateProject,
  deleteProject,
  uploadBackground,
  removeBackground,
} = require('../controllers/projectController');

router.get('/',    publicCache, getAllProjects);
// PF-113 — drafts included.
router.get('/admin/all', protect, getAllProjectsAdmin);
// ⚠️ No public GET /:id since 2026-11-02 — nothing on the site called it (only
// the Postman collection). The Projects rebuild reads a project by its slug.
router.post('/',      protect, createProject);   
router.put('/:id',    protect, updateProject);
router.delete('/:id', protect, deleteProject);

// ── NEW IN PF-111 ────────────────────────────────────────────
// `protect` runs BEFORE `uploadSingle`, copying the reasoning already
// written in aboutRoutes.js: an anonymous request is rejected on its
// headers, so a stranger cannot make the server buffer megabytes into
// memory before finding out they have no token. Reversing these two is
// a free denial-of-service.
router.put('/:id/background',    protect, uploadSingle, uploadBackground);
router.delete('/:id/background', protect, removeBackground);
// ─────────────────────────────────────────────────────────────

module.exports = router;