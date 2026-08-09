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
    imageUrl: {
      type:    String,
      default: null,
    },
    featured: {
      type:    Boolean,
      default: false,
    },
    order: {
      type:    Number,
      default: 0,
    },

    // ── NEW IN PF-52 ────────────────────────────────────────────
    // Background image shown BEHIND the project card content.
    // Different from imageUrl, which is displayed as content.
    // The admin panel uploads to Cloudinary and stores the URL here.
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