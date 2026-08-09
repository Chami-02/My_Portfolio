const { v2: cloudinary } = require('cloudinary');

// ── Cloudinary configuration (PF-63, written early for PF-60) ────────────────
// Credentials come from the environment — never hardcode them, this file is
// committed. Required vars:
//
//   CLOUDINARY_CLOUD_NAME
//   CLOUDINARY_API_KEY
//   CLOUDINARY_API_SECRET
//   CLOUDINARY_FOLDER      (optional, defaults to 'portfolio')
//
// `secure: true` forces https:// URLs. Without it Cloudinary hands back
// http:// links, which browsers block as mixed content on an https site.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

/**
 * True only when all three credentials are present.
 *
 * Checked before every upload so a missing .env produces a clear 503 instead
 * of an opaque SDK error — and so the whole test suite can run without any
 * Cloudinary account existing at all.
 */
const isConfigured = () => Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

module.exports = { cloudinary, isConfigured };
