const express   = require('express');
const router    = express.Router();
const rateLimit = require('express-rate-limit');

const { protect }      = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');
const { uploadFile }   = require('../controllers/uploadController');

// Uploads are expensive — bandwidth, storage, and third-party quota.
// Even behind auth, cap them.
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max:      20,               // 20 uploads per window
  message:  { status: 'error', message: 'Too many uploads — try again in 15 minutes' },
  standardHeaders: true,
  legacyHeaders:   false,
});

router.post('/', protect, uploadLimiter, uploadSingle, uploadFile);

module.exports = router;