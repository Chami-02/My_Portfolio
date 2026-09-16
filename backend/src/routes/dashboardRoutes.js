const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { getStats } = require('../controllers/dashboardController');

// PF-110. Its own router, NOT a sub-path of /api/blog: blogRoutes registers
// `/:slug` before `/admin/all`, and `/stats` is one segment — it would be
// swallowed as a slug lookup.
router.get('/stats', protect, getStats);

module.exports = router;
