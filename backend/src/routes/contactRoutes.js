const router   = require('express').Router();
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const {
  contactRules,
  submitContact,
  getAllMessages,
  markAsRead,
  deleteMessage,
  starRules,
  setStarred,
} = require('../controllers/contactController');


router.post('/', contactRules, validate, submitContact);
router.get('/',           protect, getAllMessages);
router.patch('/:id/read', protect, markAsRead);
// PF-115: `protect` FIRST — an anonymous request gets a 401, never a 400 that
// describes the body it should have sent (the PF-97 ordering rule).
router.patch('/:id/star', protect, starRules, validate, setStarred);
router.delete('/:id',     protect, deleteMessage);

module.exports = router;