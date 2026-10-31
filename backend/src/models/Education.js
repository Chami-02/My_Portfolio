const mongoose = require('mongoose');
const { monthYear, httpsUrl, pictureSlot } = require('./fields');

// PF-143 — one education entry, shaped like LinkedIn's education form (owner,
// 2026-10-30): school, degree, field of study, start, end (or expected), grade,
// activities and societies, description, and the school's logo (no skills, no
// proof — owner, 2026-10-31). School, start AND end are required on every save,
// drafts too; the degree is optional (owner, 2026-10-31). Draft and published
// differ only in visibility. The end date may be in the future — the site shows
// it as "expected".

const text = (label, max) => ({
  type:      String,
  trim:      true,
  default:   '',
  maxlength: [max, `${label} cannot exceed ${max} characters`],
});

const educationSchema = new mongoose.Schema(
  {
    school: {
      type:      String,
      required:  [true, 'School is required'],
      trim:      true,
      maxlength: [120, 'School cannot exceed 120 characters'],
    },
    degree:       text('Degree', 120),
    fieldOfStudy: text('Field of study', 120),
    start:        { ...monthYear('Start date'), required: [true, 'Start date is required'] },
    end:          { ...monthYear('End date'), required: [true, 'End date is required'] },
    grade:        text('Grade', 80),
    activities:   text('Activities and societies', 500),
    description:  text('Description', 1000),
    logo:         pictureSlot(),
    // The school's own site: its logo and name link there (owner, 2026-10-31).
    website:      httpsUrl('School website'),

    published: { type: Boolean, default: false },
    order:     { type: Number,  default: 0 },
  },
  { timestamps: true }
);

// An end before the start is a typo, whichever field it came from.
educationSchema.path('end').validate(function (end) {
  if (!end || !this.start) return true;
  // Compared at the coarser of the two: "2025" ends fine after "2025-06".
  const len = Math.min(end.length, this.start.length);
  return end.slice(0, len) >= this.start.slice(0, len);
},'End date cannot be before the start date');

module.exports = mongoose.model('Education', educationSchema);
