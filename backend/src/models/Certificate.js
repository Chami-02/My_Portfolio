const mongoose = require('mongoose');
const slugify  = require('slugify');
const { monthYear, httpsUrl, pictureSlot } = require('./fields');

// PF-143 — one certificate. A new one still saves as a DRAFT (invisible
// publicly), but title, issuer AND issue date are required on EVERY save,
// drafts too (owner, 2026-11-02 — Education's rule). The rule lives HERE, not
// in the controller, so every write path (create, update, backup restore's
// checks) enforces it.

const certificateSchema = new mongoose.Schema(
  {
    title: {
      type:      String,
      required:  [true, 'Certificate title is required'],
      trim:      true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    issuer: {
      type:      String,
      required:  [true, 'Issuer is required'],
      trim:      true,
      maxlength: [100, 'Issuer cannot exceed 100 characters'],
    },
    issued:  { ...monthYear('Issue date'), required: [true, 'Issue date is required'] },
    expires: monthYear('Expiry date'),
    credentialId: {
      type:      String,
      trim:      true,
      default:   '',
      maxlength: [100, 'Credential ID cannot exceed 100 characters'],
    },
    verifyUrl: httpsUrl('Verify link'),
    // Owner, 2026-11-02: EXACTLY ONE tag on every save — "one certificate
    // can't have two pills" — picked from (or added to) the `cert` vocabulary;
    // it is the public page's filter pill. A list, so the vocabulary's shared
    // cascade ($pull) and `?inUse` work unchanged. Trimmed, blanks and repeats
    // dropped, so `['', 'Cloud', 'Cloud']` is `['Cloud']`.
    tags: {
      type: [String],
      set:  (list) => [...new Set((list || []).map((t) => String(t).trim()).filter(Boolean))],
      validate: [
        { validator: (list) => list.length >= 1, message: 'Add a tag' },
        { validator: (list) => list.length <= 1, message: 'A certificate takes one tag' },
        { validator: (list) => list.every((t) => t.length <= 40), message: 'A tag cannot exceed 40 characters' },
      ],
    },
    // Owner, 2026-11-02: optional, shown under the details in the big view.
    description: {
      type:      String,
      trim:      true,
      default:   '',
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },

    // The shareable address: /certificates/<slug>.
    slug: { type: String, trim: true },

    image: pictureSlot(),

    // ⚠️ Default FALSE, unlike Project's `true`: there are no older rows to
    // keep visible, and a new record is a draft (owner rule).
    published: { type: Boolean, default: false },
    // Owner, 2026-11-02: pinned ones lead the list, with a pin on their card.
    pinned:    { type: Boolean, default: false },
    // The owner's drag order — within the pinned ones and within the rest.
    order:     { type: Number,  default: 0 },
  },
  { timestamps: true }
);

const makeSlug = (title, issuer) =>
  slugify([title, issuer].filter(Boolean).join(' '), { lower: true, strict: true, trim: true }) || 'certificate';

/**
 * The slug is made from title + issuer, and kept UNIQUE by a numeric suffix.
 *
 * ⚠️ It is made when missing, and REMADE on a rename only while the
 * certificate is a DRAFT. Once published its address may already be shared,
 * and a rename must not break the link. A backup row arrives with its slug and
 * keeps it (restore loads rows as existing documents, so nothing is "modified").
 */
certificateSchema.pre('validate', async function () {
  const renamed = !this.isNew && !this.published && (this.isModified('title') || this.isModified('issuer'));
  if (this.slug && !renamed) return;
  if (!this.title) return;

  const base = makeSlug(this.title, this.issuer);
  let slug = base;
  for (let n = 2; await this.constructor.exists({ slug, _id: { $ne: this._id } }); n += 1) {
    slug = `${base}-${n}`;
  }
  this.slug = slug;
});

certificateSchema.index({ slug: 1 }, { unique: true });

module.exports = mongoose.model('Certificate', certificateSchema);
