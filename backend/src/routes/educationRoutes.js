// PF-143 — /api/education. Public list (CDN-cached, published only) + the admin's
// writes. The school's logo has its own route (locked: every media field does);
// pictures only, never a PDF.
const router = require('express').Router();
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { publicCache } = require('../middleware/cache');
const { uploadSingle } = require('../middleware/upload');
const Education = require('../models/Education');
const { makeEntryController, reorderRules } = require('../controllers/entryController');

const c = makeEntryController({
  Model:  Education,
  label:  'Education entry',
  media:  'logo',
  folder: 'education',
  // Newest on top, like LinkedIn and a CV (owner, 2026-10-31): a new entry
  // goes in by its end date, then its start. Dates are "YYYY[-MM[-DD]]" text,
  // so a plain string comparison orders them.
  isNewer: (a, b) => (a.end || '') > (b.end || '') || ((a.end || '') === (b.end || '') && (a.start || '') > (b.start || '')),
  fields: {
    school: 'string', degree: 'string', fieldOfStudy: 'string', start: 'string', end: 'string',
    grade: 'string', activities: 'string', description: 'string', website: 'string',
    published: 'boolean', order: 'number',
  },
});

router.get('/',          publicCache, c.getPublic);
router.get('/admin/all', protect, c.getAdmin);
router.post('/',         protect, c.create);
router.put('/reorder',   protect, reorderRules, validate, c.reorder);
router.put('/:id',       protect, c.update);
router.delete('/:id',    protect, c.remove);

router.put('/:id/logo',    protect, uploadSingle, c.uploadPicture);
router.delete('/:id/logo', protect, c.removePicture);

module.exports = router;
