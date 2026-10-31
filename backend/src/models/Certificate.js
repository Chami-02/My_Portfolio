const mongoose = require('mongoose');
const slugify  = require('slugify');
const { monthYear, httpsUrl, pictureSlot } = require('./fields');

// PF-143 — one certificate. Drafts follow the site rule (a NEW record saves as
// a title-only draft, invisible publicly); a published one needs an issuer and
// an issue date. The rule lives HERE, not in the controller, so every write
// path (create, update, backup restore's checks) enforces it.

function isPublished() {
  return this.published === true;
}

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
      required:  [isPublished, 'Issuer is required'],
      trim:      true,
      maxlength: [100, 'Issuer cannot exceed 100 characters'],
    },
    issued:  { ...monthYear('Issue date'), required: [isPublished, 'Issue date is required'] },
    expires: monthYear('Expiry date'),
    credentialId: {
      type:      String,
      trim:      true,
      default:   '',
      maxlength: [100, 'Credential ID cannot exceed 100 characters'],
    },
    verifyUrl: httpsUrl('Verify link'),

    // The shareable address: /certificates/<slug>.
    slug: { type: String, trim: true },

    image: pictureSlot(),

    // ⚠️ Default FALSE, unlike Project's `true`: there are no older rows to
    // keep visible, and a new record is a draft (owner rule).
    published: { type: Boolean, default: false },
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
