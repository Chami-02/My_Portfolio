const router   = require('express').Router();
const validate = require('../middleware/validate');
const {
  aboutRules,
  getAbout,
  updateAbout,
  toggleAvailability,
} = require('../controllers/aboutController');

// const { protect } = require('../middleware/auth'); // Uncomment in PF-35

// Public
router.get('/', getAbout);

// Protected
router.put('/',                    aboutRules, validate, /* protect, */ updateAbout);
router.patch('/availability',      /* protect, */ toggleAvailability);

module.exports = router;