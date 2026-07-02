const router = require('express').Router();
const {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
} = require('../controllers/projectController');

// Public — anyone can read projects
router.get('/',    getAllProjects);
router.get('/:id', getProjectById);

// Protected — require JWT in Sprint 6 (PF-35)
// Uncomment these two lines after PF-35:
// const { protect } = require('../middleware/auth');
router.post('/',      /* protect, */ createProject);
router.put('/:id',    /* protect, */ updateProject);
router.delete('/:id', /* protect, */ deleteProject);

module.exports = router;