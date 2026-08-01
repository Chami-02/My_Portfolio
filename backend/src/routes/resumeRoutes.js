const router = require('express').Router();

const { downloadResume } = require('../controllers/aboutController');

// ── NEW IN PF-60 ─────────────────────────────────────────────────────────────
// Public — GET /api/resume → 302 redirect to the forced-download URL.
//
// Deliberately its own mount rather than /api/about/resume: this is the URL
// that goes in an email signature or a CV link, so it should be short and it
// must keep working after every replacement. The Cloudinary URL underneath
// changes on each upload; this one never does.
router.get('/', downloadResume);

module.exports = router;
