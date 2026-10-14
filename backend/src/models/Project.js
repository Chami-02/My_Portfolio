const mongoose = require('mongoose');

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
  message:   `${label} must be an http(s) address`,
});

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
        message:   'Tech array cannot be empty',
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
    // Background image shown BEHIND the project card content, at the
    // opacity stored beside it. Rendered by ProjectsSection.jsx:98.
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
          message: 'Background image must be an http(s) URL',
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

module.exports = mongoose.model('Project', projectSchema);