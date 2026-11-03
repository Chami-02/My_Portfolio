const mongoose = require('mongoose');
const slugify  = require('slugify');
const { monthYear } = require('./fields');
const { makeSectionSchema } = require('./sectionSchema');

// ── PF-113: drafts ──────────────────────────────────────────────────────────
// A project saved with `published: false` is a DRAFT — invisible on the public
// site, and allowed to be half-finished (owner, 2026-10-03: "save as draft",
// so a half-written project is not lost). Only `title` is required for one,
// so it can be found in the admin list; everything else is required the
// moment the project is published.
//
// ⚠️ `this` must be the DOCUMENT for these conditions to mean anything. Under
// findByIdAndUpdate's update validators `this` is the Query, `this.published`
// is undefined, and the condition silently answers "published" — which is why
// updateProject uses findById + save(). Pinned by projects.test.js.
function isPublished() {
  return this.published !== false;
}

// Both URLs render as public hrefs. `^https?://` keeps `javascript:` and
// `data:` out — the same reason backgroundImage.src rejects data: URIs. The
// pattern is the frontend's `isUsableUrl` (utils/formErrors.js), so the panel's
// courtesy check and this gate agree. Blank is allowed HERE; whether blank is
// acceptable is `required`'s call.
const httpUrl = (label) => ({
  validator: (value) => !value || /^https?:\/\/.+\..+/i.test(value),
  message:   `${label} must be a full web address starting with https://`,
});

// ── NEW IN PF-144 ───────────────────────────────────────────────────────────
// Short optional text lines shown under the title (owner, 2026-11-03).
const text = (label, max) => ({
  type:      String,
  trim:      true,
  default:   '',
  maxlength: [max, `${label} cannot exceed ${max} characters`],
});

// A project page's sections — Blog's shape, asking THIS model's draft rule.
const sectionSchema = makeSectionSchema((project) => project.published !== false, { withImages: true });

/**
 * PF-144 — the project's RECEIPT BOOK of uploaded section pictures. Written
 * ONLY by POST /api/projects/:id/images, from Cloudinary's own answer. A
 * section may show a picture only by naming a `publicId` that is in here, so
 * a client can never point the site — or a later delete — at a file this
 * project did not upload (OWASP: insecure direct object reference / mass
 * assignment). Entries no section uses are destroyed after each save.
 */
const mediaEntrySchema = new mongoose.Schema(
  {
    publicId:   { type: String, required: true },
    url:        { type: String, required: true },
    width:      { type: Number, default: 0 },
    height:     { type: Number, default: 0 },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    title: {
      type:      String,
      required:  [true, 'Project title is required'],
      trim:      true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    description: {
      type:      String,
      required:  [isPublished, 'Project description is required'],
      trim:      true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    tech: {
      type:     [String],
      // ⚠️ No `required` — Mongoose treats an array as always present, so the
      // real check was only ever this validator. `function`, not an arrow:
      // it reads `this` (see isPublished).
      validate: {
        validator: function (arr) { return !isPublished.call(this) || arr.length > 0; },
        message:   'Add at least one technology.',
      },
    },
    githubUrl: {
      type:     String,
      required: [isPublished, 'GitHub URL is required'],
      trim:     true,
      validate: httpUrl('GitHub URL'),
    },
    liveUrl: {
      type:     String,
      default:  null,
      trim:     true,
      validate: httpUrl('Live URL'),
    },
    // ── NEW IN PF-144 — the project's own page, /projects/<slug> ──
    // The address. Made from the title, kept unique by a numeric suffix,
    // and frozen once published — see the pre('validate') hook below.
    slug: { type: String, trim: true },
    // `description` stays the SHORT summary (cards, two lines); the page's
    // long text lives here, in the same editor Blog uses.
    sections: {
      type:    [sectionSchema],
      default: [],
      validate: {
        validator(list) { return !isPublished.call(this) || list.length > 0; },
        message:   'A project needs a page — add at least one section',
      },
    },
    // The label on the card's picture, from the `category` vocabulary. At
    // most ONE (owner, 2026-11-03), stored as a list so the vocabulary's
    // shared cascade ($pull) and `?inUse` work unchanged — Certificate's
    // `tags` shape. Optional: a project may have no label.
    categories: {
      type: [String],
      set:  (list) => [...new Set((list || []).map((t) => String(t).trim()).filter(Boolean))],
      validate: [
        { validator: (list) => list.length <= 1, message: 'A project takes one category' },
        { validator: (list) => list.every((t) => t.length <= 40), message: 'A category cannot exceed 40 characters' },
      ],
    },
    // PF-144 — see mediaEntrySchema. Never written by a normal save.
    media: { type: [mediaEntrySchema], default: [] },
    role:      text('Role', 80),
    client:    text('Client', 80),
    startedOn: monthYear('Start date'),
    endedOn:   monthYear('End date'),
    // "FEB 2024 – PRESENT". An ongoing project has no end date.
    ongoing:   { type: Boolean, default: false },

    // ── NEW IN PF-113 ─────────────────────────────────────────────
    // Default TRUE, deliberately: every existing document (which has no such
    // field) and any API caller that omits it stays live. The public queries
    // filter `{ published: { $ne: false } }`, so a missing field already
    // reads as published and no migration is needed.
    published: {
      type:    Boolean,
      default: true,
    },
    featured: {
      type:    Boolean,
      default: false,
    },
    order: {
      type:    Number,
      default: 0,
    },

    // ── NEW IN PF-52 · publicId added in PF-111 ─────────────────
    // The project's picture. Until PF-144 it was shown BEHIND the card's
    // text at `opacity`; since PF-144 it is the picture ON TOP of the card
    // and on the project page, and `opacity` is no longer read (left in
    // place — CONTRACT a release later).
    //
    // ⚠️ PF-111 DELETED the sibling `imageUrl` field this comment used
    // to contrast against. It was a bare String with zero consumers in
    // either package — never seeded, never written, never read — so the
    // contrast it drew no longer exists. There is ONE image per project.
    backgroundImage: {
      src: {
        type:    String,
        default: '',
        validate: {
          // Allow: empty string (no image), or an http/https URL.
          // Reject: data: URIs — they bloat the database and can
          // carry stored-XSS payloads via SVG.
          validator: function (value) {
            if (!value) return true;                    // empty is valid
            return /^https?:\/\//i.test(value);
          },
          message: 'The picture link must be a full web address starting with https://',
        },
      },
      // ── NEW IN PF-111 ─────────────────────────────────────────
      // Cloudinary's public_id for the file at `src`. Without it the
      // old file can never be deleted, so replacing a background would
      // orphan one in the bucket forever. Written ONLY by
      // PUT /api/projects/:id/background, never by a normal save —
      // see the strip in updateProject().
      publicId: { type: String, default: '' },

      opacity: {
        type:    Number,
        default: 0.75,
        min:     [0.1, 'Opacity cannot be below 0.1'],
        max:     [1.0, 'Opacity cannot exceed 1.0'],
      },
    },
    // ────────────────────────────────────────────────────────────
  },
  { timestamps: true }  // Adds createdAt and updatedAt automatically
);

// ── PF-144 ──────────────────────────────────────────────────────────────────
// An end before the start is a typo (Education's rule, compared at the
// coarser of the two so "2025" ends fine after "2025-06").
projectSchema.path('endedOn').validate(function (end) {
  if (!end || !this.startedOn) return true;
  const len = Math.min(end.length, this.startedOn.length);
  return end.slice(0, len) >= this.startedOn.slice(0, len);
}, 'End date cannot be before the start date');

projectSchema.path('ongoing').validate(function (ongoing) {
  return !(ongoing && this.endedOn);
}, 'An ongoing project has no end date');

const makeSlug = (title) =>
  slugify(title || '', { lower: true, strict: true, trim: true }) || 'project';

/**
 * The slug is made from the title and kept UNIQUE by a numeric suffix —
 * Certificate's rule (PF-143), not Blog's (Blog remakes it on every rename
 * and answers a clash with a 409).
 *
 * ⚠️ It is made when missing, and REMADE on a rename only while the project
 * is a DRAFT. Once published its address may already be shared, and a rename
 * must not break the link. `published !== false` is this model's "live".
 */
projectSchema.pre('validate', async function () {
  const renamed = !this.isNew && this.published === false && this.isModified('title');
  if (this.slug && !renamed) return;
  if (!this.title) return;

  const base = makeSlug(this.title);
  let slug = base;
  for (let n = 2; await this.constructor.exists({ slug, _id: { $ne: this._id } }); n += 1) {
    slug = `${base}-${n}`;
  }
  this.slug = slug;
});

// `sparse`: a row older than PF-144 has no slug until migration 013 runs.
projectSchema.index({ slug: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Project', projectSchema);