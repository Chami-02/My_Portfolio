const router   = require('express').Router();
const validate = require('../middleware/validate');
const {
  contactRules,
  submitContact,
  getAllMessages,
  markAsRead,
  deleteMessage,
} = require('../controllers/contactController');

// const { protect } = require('../middleware/auth'); // Uncomment in PF-35

// Public — submit form
router.post('/', contactRules, validate, submitContact);

// Protected — admin only
router.get('/',             /* protect, */ getAllMessages);
router.patch('/:id/read',   /* protect, */ markAsRead);
router.delete('/:id',       /* protect, */ deleteMessage);

module.exports = router;