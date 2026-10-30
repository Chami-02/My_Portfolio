const router = require('express').Router();
const { protect }       = require('../middleware/auth');
const validate          = require('../middleware/validate');
const { backupLimiter } = require('../middleware/rateLimiter');
const { uploadBackup }  = require('../middleware/upload');
const {
  backupRules, downloadBackup, checkRestore, restore, listSafetyCopies, downloadSafetyCopy,
} = require('../controllers/backupController');

// PF-135 — every route is signed in. The ones that check the password, or
// take a file, are limited (one shared counter, 10 / 15 min). The upload goes
// BEFORE the rules on /restore: the password travels as a field of the same
// multipart form, and only multer can read it.
router.post('/',              protect, backupLimiter, backupRules, validate, downloadBackup);
router.post('/restore/check', protect, backupLimiter, uploadBackup, checkRestore);
router.post('/restore',       protect, backupLimiter, uploadBackup, backupRules, validate, restore);
router.get('/safety',         protect, listSafetyCopies);
router.post('/safety/:id',    protect, backupLimiter, backupRules, validate, downloadSafetyCopy);

module.exports = router;
