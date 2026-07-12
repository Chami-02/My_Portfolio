const router   = require('express').Router();
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const {
  contactRules,
  submitContact,
  getAllMessages,
  markAsRead,
  deleteMessage,
} = require('../controllers/contactController');


router.post('/', contactRules, validate, submitContact);
router.get('/',           protect, getAllMessages);
router.patch('/:id/read', protect, markAsRead);
router.delete('/:id',     protect, deleteMessage);

module.exports = router;