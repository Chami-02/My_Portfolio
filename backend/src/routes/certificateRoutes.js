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
  // Owner, 2026-11-02: PINNED always first; within the pinned ones and within
  // the rest, the owner's drag order. A new certificate goes in by its issue
  // date (newest on top) — never above a pinned one, unless it is pinned
  // itself. Issue dates are "YYYY[-MM[-DD]]" text, so a text compare IS a
  // date compare (a year alone counts as its start).
  sort: { pinned: -1, order: 1, createdAt: 1 },
  pagePrefix: '/certificates/',
  isNewer: (a, b) => ((a.pinned === true) !== (b.pinned === true)
    ? a.pinned === true
    : (a.issued || '') > (b.issued || '')),
  fields: {
    title: 'string', issuer: 'string', issued: 'string', expires: 'string',
    credentialId: 'string', verifyUrl: 'string', description: 'string', tags: 'string[]',
    published: 'boolean', pinned: 'boolean', order: 'number',
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
