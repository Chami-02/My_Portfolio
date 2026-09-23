const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');
const {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  uploadBackground,
  removeBackground,
} = require('../controllers/projectController');

router.get('/',    getAllProjects);
router.get('/:id', getProjectById);
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