const router   = require('express').Router();
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const {
  aboutRules,
  getAbout,
  updateAbout,
  toggleAvailability,
} = require('../controllers/aboutController');


router.get('/', getAbout);
router.put('/', aboutRules, validate, protect, updateAbout);
router.patch('/availability', protect, toggleAvailability);

module.exports = router;