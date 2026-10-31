// PF-143 — /api/certificates. Public list (CDN-cached, published only) + the admin's
// writes. The picture has its own route (locked: every media field does).
const router = require('express').Router();
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { publicCache } = require('../middleware/cache');
const { uploadSingle } = require('../middleware/upload');
const Certificate = require('../models/Certificate');
const { makeEntryController, reorderRules } = require('../controllers/entryController');

const c = makeEntryController({
  Model:  Certificate,
  label:  'Certificate',
  media:  'image',
  folder: 'certificates',
  allowPdf: true,
  fields: {
    title: 'string', issuer: 'string', issued: 'string', expires: 'string',
    credentialId: 'string', verifyUrl: 'string', published: 'boolean', order: 'number',
  },
});

router.get('/',          publicCache, c.getPublic);
router.get('/admin/all', protect, c.getAdmin);
router.post('/',         protect, c.create);
router.put('/reorder',   protect, reorderRules, validate, c.reorder);
router.put('/:id',       protect, c.update);
router.delete('/:id',    protect, c.remove);

router.put('/:id/image',    protect, uploadSingle, c.uploadPicture);
router.delete('/:id/image', protect, c.removePicture);

module.exports = router;
