const router = require('express').Router();
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { getStats } = require('../controllers/dashboardController');
const {
  rangeRules, getAnalytics, getGrowth, getLive, exportCsv,
} = require('../controllers/audienceController');

// PF-110. Its own router, NOT a sub-path of /api/blog: blogRoutes registers
// `/:slug` before `/admin/all`, and `/stats` is one segment — it would be
// swallowed as a slug lookup.
router.get('/stats', protect, getStats);

// PF-149 — the private Analytics panel. ⚠️ `audience`, never `analytics`: ad
// blockers' lists target that word, and the panel would simply fail.
router.get('/audience',         protect, rangeRules, validate, getAnalytics);
router.get('/audience/growth', protect, getGrowth);
router.get('/audience/live',    protect, getLive);
router.get('/audience/export', protect, exportCsv);

module.exports = router;
