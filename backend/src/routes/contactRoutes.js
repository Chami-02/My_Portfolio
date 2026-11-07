const router   = require('express').Router();
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { contactLimiter, replyLimiter } = require('../middleware/rateLimiter');
const {
  contactRules,
  submitContact,
  getAllMessages,
  markAsRead,
  readRules,
  deleteMessage,
  starRules,
  setStarred,
  bulkRules,
  bulkMessages,
  replyRules,
  replyToMessage,
} = require('../controllers/contactController');


// PF-120: its own limiter — the form is public, and every stored message will
// become an email (PF-123).
router.post('/', contactLimiter, contactRules, validate, submitContact);
router.get('/',           protect, getAllMessages);
router.post('/bulk',      protect, bulkRules, validate, bulkMessages);
router.post('/:id/reply', protect, replyLimiter, replyRules, validate, replyToMessage);
router.patch('/:id/read', protect, readRules, validate, markAsRead);
// PF-115: `protect` FIRST — an anonymous request gets a 401, never a 400 that
// describes the body it should have sent (the PF-97 ordering rule).
router.patch('/:id/star', protect, starRules, validate, setStarred);
router.delete('/:id',     protect, deleteMessage);

module.exports = router;