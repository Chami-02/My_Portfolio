const mongoose = require('mongoose');

const vocabularySchema = new mongoose.Schema(
  {
    type: {
      type:     String,
      required: [true, 'Vocabulary type is required'],
      enum: {
        values:  ['tag', 'tech'],
        message: '{VALUE} is not a valid vocabulary type — use "tag" or "tech"',
      },
    },
    value: {
      type:      String,
      required:  [true, 'Vocabulary value is required'],
      trim:      true,
      maxlength: [40, 'Value cannot exceed 40 characters'],
      validate: {
        // Allow letters, numbers, spaces, and the characters that
        // appear in real tech names: . + # - /
        // e.g. "Node.js", "C++", "C#", "CI/CD", "Tailwind-CSS"
        validator: v => /^[A-Za-z0-9 .+#\-/]+$/.test(v),
        message:   'Value may only contain letters, numbers, spaces and . + # - /',
      },
    },
    order: {
      type:    Number,
      default: 0,   // for manual ordering later; unused for now
    },
  },
  { timestamps: true }
);

// ── Prevent duplicates ───────────────────────────────────────────────────────
// A compound unique index: you may have BOTH tag "Docker" and tech "Docker",
// but never two tech "Docker" entries.
vocabularySchema.index({ type: 1, value: 1 }, { unique: true });

// Fast lookup when the picker loads one type
vocabularySchema.index({ type: 1, order: 1 });

module.exports = mongoose.model('Vocabulary', vocabularySchema);