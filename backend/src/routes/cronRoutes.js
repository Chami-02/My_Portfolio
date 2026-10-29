const router = require('express').Router();
const { sendDigest } = require('../controllers/digestController');

// Vercel Cron (backend/vercel.json `crons`). GET is what Vercel sends; the
// controller refuses anything without the CRON_SECRET bearer.
router.get('/digest', sendDigest);

module.exports = router;
