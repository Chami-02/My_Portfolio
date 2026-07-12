const router = require('express').Router();
const { protect } = require('../middleware/auth');
const {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
} = require('../controllers/projectController');

router.get('/',    getAllProjects);
router.get('/:id', getProjectById);
router.post('/',      protect, createProject);   
router.put('/:id',    protect, updateProject);
router.delete('/:id', protect, deleteProject);

module.exports = router;