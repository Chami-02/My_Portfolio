const router = require('express').Router();
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const {
  getCategories, createCategory, renameCategory, reorderCategories, deleteCategory,
  createRules, renameRules, reorderRules,
} = require('../controllers/skillCategoryController');

// PF-114 — owner-managed Skills sections. `protect` BEFORE every rule array
// (the PF-97 ordering), and '/reorder' BEFORE '/:id' so it is not read as an id.
router.get('/',           getCategories);
router.post('/',          protect, createRules, validate, createCategory);
router.put('/reorder',    protect, reorderRules, validate, reorderCategories);
router.put('/:id',        protect, renameRules, validate, renameCategory);
router.delete('/:id',     protect, deleteCategory);

module.exports = router;
