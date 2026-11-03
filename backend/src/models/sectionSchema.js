const mongoose = require('mongoose');

// ── PF-59 (Blog) · shared with Project since PF-144 ───────────────
// One section of a post or a project page, rendered in order, numbered
// 01, 02, 03… A section may have body paragraphs, bullets, or both. It may
// NOT have neither on a PUBLISHED record — that would render as an empty
// heading. A draft keeps a half-written section rather than losing it.
//
// ⚠️ A factory, because "published" differs per owner: Blog is
// `published === true` (it has always carried the flag), Project is
// `published !== false` (rows older than PF-113 have no flag and are live).
// The rules run on a SUBDOCUMENT, whose `this` is the section; the record
// that decides is its owner.

/** PF-144 — the most pictures one section may show (owner, 2026-11-03). */
const MAX_SECTION_IMAGES = 4;

/**
 * One picture inside a section (PF-144, projects only). `url`, `width` and
 * `height` are NEVER taken from a client: the controller copies them from the
 * project's own `media` ledger, matched by `publicId` (see projectController
 * `attachSectionImages`). Only `publicId` and `caption` come from the form.
 */
const sectionImageSchema = new mongoose.Schema(
  {
    url:      { type: String, required: true },
    publicId: { type: String, required: true },
    caption:  { type: String, trim: true, default: '', maxlength: [120, 'A caption cannot exceed 120 characters'] },
    width:    { type: Number, default: 0 },
    height:   { type: Number, default: 0 },
  },
  { _id: false }
);

/**
 * @param {(owner: object) => boolean} ownerIsPublished
 * @param {{ withImages?: boolean }} [options]  PF-144: Projects' sections may
 *        carry up to MAX_SECTION_IMAGES pictures; Blog's may not (strict mode
 *        drops an `images` key sent for a post).
 * @returns {mongoose.Schema}
 */
function makeSectionSchema(ownerIsPublished, { withImages = false } = {}) {
  const published = (section) => {
    const owner = typeof section.ownerDocument === 'function' ? section.ownerDocument() : null;
    return Boolean(owner && ownerIsPublished(owner));
  };

  const schema = new mongoose.Schema(
    {
      heading: {
        type:      String,
        // PF-115: required only once the record is published.
        required:  [function () { return published(this); }, 'Section heading is required'],
        trim:      true,
        maxlength: [200, 'Heading cannot exceed 200 characters'],
      },
      body: {
        type:    [String],   // each element = one paragraph
        default: [],
      },
      bullets: {
        type:    [String],   // each element = one bullet point
        default: [],
      },
      ...(withImages && {
        images: {
          type:    [sectionImageSchema],
          default: [],
          validate: {
            validator: (list) => list.length <= MAX_SECTION_IMAGES,
            message:   `A section can show at most ${MAX_SECTION_IMAGES} pictures`,
          },
        },
      }),
    },
    { _id: false }   // sections are positional, not independently addressable
  );

  schema.pre('validate', function () {
    if (!published(this)) return;
    // PF-144: on a project, pictures count as content — a screenshot
    // section may be a heading and its pictures.
    const pictures = withImages ? this.images.length : 0;
    if (this.body.length === 0 && this.bullets.length === 0 && pictures === 0) {
      throw new Error(withImages
        ? 'A section must have at least one paragraph, bullet or picture'
        : 'A section must have at least one paragraph or bullet');
    }
  });

  return schema;
}

module.exports = { makeSectionSchema, MAX_SECTION_IMAGES };
