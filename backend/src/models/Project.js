const mongoose = require('mongoose');

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
      required:  [true, 'Project description is required'],
      trim:      true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    tech: {
      type:     [String],
      required: [true, 'At least one technology is required'],
      validate: {
        validator: (arr) => arr.length > 0,
        message:   'Tech array cannot be empty',
      },
    },
    githubUrl: {
      type:     String,
      required: [true, 'GitHub URL is required'],
      trim:     true,
    },
    liveUrl: {
      type:    String,
      default: null,
      trim:    true,
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