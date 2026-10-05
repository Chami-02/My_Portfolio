const mongoose = require('mongoose');

/**
 * PF-114 — a Skills SECTION (owner, 2026-10-05): the boxes on the home page's
 * Skills section, now owner-managed instead of a hardcoded enum.
 *
 * `key`   — what `Skill.category` stores. A stable slug, set ONCE at create and
 *           never changed by a rename, so renaming a section never has to
 *           rewrite a single skill. The six defaults reuse the old enum values
 *           exactly, so every existing skill is already valid.
 * `label` — what the page shows. Free to change.
 * `order` — box order on the home page and in the admin.
 */
const skillCategorySchema = new mongoose.Schema(
  {
    key: {
      type:     String,
      required: [true, 'Section key is required'],
      unique:   true,
      trim:     true,
    },
    label: {
      type:      String,
      required:  [true, 'Section name is required'],
      trim:      true,
      maxlength: [40, 'Section name cannot exceed 40 characters'],
    },
    order: {
      type:    Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SkillCategory', skillCategorySchema);
