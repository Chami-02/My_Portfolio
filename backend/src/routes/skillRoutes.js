const router = require('express').Router();
const {
  getAllSkills,
  createSkill,
  updateSkill,
  deleteSkill,
} = require('../controllers/skillController');

// const { protect } = require('../middleware/auth'); // Uncomment in PF-35

router.get('/',       getAllSkills);
router.post('/',      /* protect, */ createSkill);
router.put('/:id',    /* protect, */ updateSkill);
router.delete('/:id', /* protect, */ deleteSkill);

module.exports = router;