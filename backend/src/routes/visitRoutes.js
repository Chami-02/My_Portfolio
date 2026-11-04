const router   = require('express').Router();
const validate = require('../middleware/validate');
const { visitLimiter } = require('../middleware/rateLimiter');
const {
  visitRules,
  ignoreBots,
  identifyVisitor,
  recordVisit,
} = require('../controllers/visitController');

// PF-145. Bots leave first, so they write nothing at all — not even a limiter
// row. The scrambled source has to exist before the limiter, which keys on it.
router.post('/', ignoreBots, identifyVisitor, visitLimiter, visitRules, validate, recordVisit);

module.exports = router;
