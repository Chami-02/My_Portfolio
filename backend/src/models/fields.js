// PF-143 — field shapes shared by Education and Certificate. Not a model.

/**
 * "2025", "2025-06" or "2025-06-04": a year, a month and year, or a full date
 * (the day is optional — owner, 2026-10-31). Empty is allowed.
 */
const MONTH_YEAR = /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/;

/** The shape, AND a day that exists in its month (no 31 APR, no 29 FEB 2025). */
const isMonthYear = (v) => {
  if (!MONTH_YEAR.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  return !d || d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
};

const monthYear = (label) => ({
  type:     String,
  trim:     true,
  default:  '',
  validate: {
    validator: (v) => !v || isMonthYear(v),
    message:   `${label} must be a year, a month and year, or a full date`,
  },
});

/** A link a visitor opens — https only (verify pages, school websites). Empty is allowed. */
const httpsUrl = (label) => ({
  type:     String,
  trim:     true,
  default:  '',
  maxlength: [500, `${label} cannot exceed 500 characters`],
  validate: {
    validator: (v) => !v || /^https:\/\/[^\s/]+\.[^\s]+$/i.test(v),
    message:   `${label} must be an https:// address`,
  },
});

/**
 * The picture a certificate or an education entry shows. Written ONLY by its
 * dedicated upload route, from Cloudinary's own answer (never a client-supplied
 * publicId). `format` is the UPLOADED file's ('pdf' when the picture is a PDF's
 * first page) — the `url` is always an image either way.
 */
const pictureSlot = () => ({
  url: {
    type:    String,
    default: '',
    validate: {
      validator: (v) => !v || /^https:\/\//i.test(v),
      message:   'Picture URL must be an https URL',
    },
  },
  publicId:   { type: String, default: '' },
  format:     { type: String, default: '' },
  width:      { type: Number, default: 0 },
  height:     { type: Number, default: 0 },
  bytes:      { type: Number, default: 0 },
  uploadedAt: { type: Date,   default: null },
});

module.exports = { MONTH_YEAR, monthYear, httpsUrl, pictureSlot };
