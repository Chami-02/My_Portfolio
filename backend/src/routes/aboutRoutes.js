const router   = require('express').Router();
const validate = require('../middleware/validate');
const { protect }      = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');
const {
  aboutRules,
  getAbout,
  updateAbout,
  toggleAvailability,
  uploadResume,
  removeResume,
} = require('../controllers/aboutController');


router.get('/', getAbout);
router.put('/', aboutRules, validate, protect, updateAbout);
router.patch('/availability', protect, toggleAvailability);

// ── NEW IN PF-60 ─────────────────────────────────────────────
// `protect` runs BEFORE `uploadSingle` deliberately: an anonymous
// request is rejected on its headers, so a stranger cannot make the
// server buffer 5 MB into memory before finding out they have no
// token. Reversing these two is a free denial-of-service.
router.put('/resume',    protect, uploadSingle, uploadResume);
router.delete('/resume', protect, removeResume);
// ─────────────────────────────────────────────────────────────

module.exports = router;