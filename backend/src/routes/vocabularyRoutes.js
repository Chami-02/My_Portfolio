const express = require('express');
const router  = express.Router();

const { protect } = require('../middleware/auth');

const {
  getVocabulary,
  getDeleteImpact,
  createVocabulary,
  deleteVocabulary,
} = require('../controllers/vocabularyController');

// Public — the picker needs to load chips without auth on the public site
router.get('/:type', getVocabulary);

// Protected — admin only
router.get('/:type/:id/impact', protect, getDeleteImpact);
router.post('/:type',           protect, createVocabulary);
router.delete('/:type/:id',     protect, deleteVocabulary);

module.exports = router;