const router = require('express').Router();
const { protect } = require('../middleware/auth');
const {
  getAllSkills,
  createSkill,
  updateSkill,
  deleteSkill,
} = require('../controllers/skillController');



router.get('/',       getAllSkills);
router.post('/',      protect, createSkill);
router.put('/:id',    protect, updateSkill);
router.delete('/:id', protect, deleteSkill);

module.exports = router;