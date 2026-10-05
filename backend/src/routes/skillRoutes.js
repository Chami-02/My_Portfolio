const router = require('express').Router();
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const {
  getAllSkills,
  createSkill,
  updateSkill,
  reorderSkills,
  reorderRules,
  deleteSkill,
} = require('../controllers/skillController');

router.get('/',       getAllSkills);
router.post('/',      protect, createSkill);
// ⚠️ PF-114 — declared BEFORE '/:id', or Express matches 'reorder' as an id and
// updateSkill answers "Invalid skill ID". And `protect` BEFORE the rules (the
// PF-97 ordering): an anonymous request gets a 401, never a schema description.
router.put('/reorder', protect, reorderRules, validate, reorderSkills);
router.put('/:id',    protect, updateSkill);
router.delete('/:id', protect, deleteSkill);

module.exports = router;
