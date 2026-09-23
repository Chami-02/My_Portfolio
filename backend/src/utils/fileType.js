// backend/src/utils/fileType.js
//
// PF-111 — one home for magic-byte file detection.
//
// WHY THIS FILE EXISTS. Before PF-111 there were two independent sniffers:
// `detectFileType()` in uploadController.js (five formats, plus three
// recognised-but-rejected ones) and `isPdf()` in aboutController.js (the five
// bytes "%PDF-"). PF-111 adds two more upload handlers — the About portrait and
// the project background — which brings the number of callers to four. Copying
// a security check into a fourth file is how one copy drifts and a format that
// is rejected in three places quietly gets through in the fourth.
//
// ⚠️ THE CHECK IS THE BYTES, NEVER THE NAME. Neither the file extension nor the
// Content-Type header is evidence of anything: both are chosen by the client.
// `middleware/upload.js`'s multer `fileFilter` screens the CLAIMED mimetype,
// which is worth doing because it rejects the obvious cases before 5 MB is
// buffered — but it is not a gate, and nothing here should be read as trusting
// it.
//
// Deliberately NOT the `file-type` package, for the reason already recorded
// against the PDF check: v17+ is pure ESM and will not require() from this
// CommonJS backend, while the last CommonJS line (v16) is EOL and carries
// GHSA-5v7r-6r5c-r473 — an infinite loop in its ASF parser, which would hang
// Node's single event loop and take the whole server with it. Sniffing only the
// formats we accept is also strictly safer than a general detector: a malformed
// file never reaches a parser at all, it just fails every check and is rejected.

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Formats accepted where an IMAGE is expected — the About portrait and project
 * card backgrounds (PF-111).
 *
 * ⚠️ SVG IS DELIBERATELY ABSENT, and it is the one exclusion worth explaining.
 * SVG is not a picture format; it is an XML document that may carry <script>.
 * Served from our own Cloudinary delivery URL and opened directly it is a
 * stored-XSS vector, which is exactly why `Project.backgroundImage.src` already
 * rejects `data:` URIs. Owner decision, 2026-09-23: PNG, JPEG, WebP only.
 *
 * ⚠️ Narrower than `middleware/upload.js`'s ALLOWED_IMAGE_MIME, which also
 * lists image/avif because POST /api/upload accepts it. That is not an
 * oversight: multer's list screens the claimed type for every upload route,
 * and THIS list is the gate for the two portrait/background handlers.
 */
const MEDIA_IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp'];

/**
 * Magic-byte sniffer.
 *
 * Returns { mime } — the shape the calling code expects — or null when the
 * bytes match nothing known.
 */
const detectFileType = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 5) return null;

  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return { mime: 'image/png' };
  }

  // JPEG always opens FF D8 FF; the fourth byte varies by marker.
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg' };
  }

  // RIFF container: "RIFF" <4-byte length> "WEBP"
  if (buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('latin1')  === 'RIFF' &&
      buffer.subarray(8, 12).toString('latin1') === 'WEBP') {
    return { mime: 'image/webp' };
  }

  // ISO-BMFF: <4-byte box size> "ftyp" <major brand> ... <compatible brands>.
  // Some encoders declare avif only in the compatible-brand list, so scan the
  // whole brand region rather than just the major brand.
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('latin1') === 'ftyp') {
    const brands = buffer.subarray(8, Math.min(buffer.length, 32)).toString('latin1');
    if (brands.includes('avif') || brands.includes('avis')) {
      return { mime: 'image/avif' };
    }
  }

  if (buffer.subarray(0, 5).toString('latin1') === '%PDF-') {
    return { mime: 'application/pdf' };
  }

  // ── Recognised but NOT allowed ───────────────────────────────────────────
  // Identifying these buys a precise 415 naming the real type, instead of a
  // misleading 400 telling the user their perfectly valid GIF is corrupt.
  // Uploading a GIF or a screenshot-as-BMP is an ordinary mistake, not an
  // attack, and the error should say so.
  if (buffer.subarray(0, 4).toString('latin1') === 'GIF8') return { mime: 'image/gif' };

  if (buffer.length >= 14 && buffer.subarray(0, 2).toString('latin1') === 'BM') {
    return { mime: 'image/bmp' };
  }

  // TIFF: "II" 2A 00 (little-endian) or "MM" 00 2A (big-endian). Compared as raw
  // bytes, not text — the marker contains a NUL that a string literal mangles.
  if (buffer.subarray(0, 4).equals(Buffer.from([0x49, 0x49, 0x2a, 0x00])) ||
      buffer.subarray(0, 4).equals(Buffer.from([0x4d, 0x4d, 0x00, 0x2a]))) {
    return { mime: 'image/tiff' };
  }

  // ⚠️ SVG is intentionally NOT detected here and therefore returns null, which
  // the image handlers turn into a 415. It has no magic number — an SVG is just
  // XML, optionally preceded by whitespace, a BOM or a <?xml ...?> declaration —
  // so "recognise it in order to name it" would mean sniffing text, and any
  // rule loose enough to catch every real SVG is loose enough to mislabel other
  // XML. Rejecting it as unrecognised is the correct and safe outcome; the
  // handler's message names what IS allowed, which is the actionable half.
  return null;
};

/**
 * True if the buffer really is a PDF (the résumé slot, PF-60).
 *
 * Kept as its own named export rather than leaving callers to compare mime
 * strings: it is the only check `uploadResume` needs, and it reads as the
 * question being asked.
 */
const isPdf = (buffer) => {
  const detected = detectFileType(buffer);
  return Boolean(detected) && detected.mime === 'application/pdf';
};

/**
 * True if the buffer really is one of the image formats the portrait and
 * background slots accept. Takes the BUFFER, not a mime string, so there is no
 * way to call it with a client-supplied value by mistake.
 */
const isAllowedImage = (buffer) => {
  const detected = detectFileType(buffer);
  return Boolean(detected) && MEDIA_IMAGE_MIME.includes(detected.mime);
};

module.exports = { detectFileType, isPdf, isAllowedImage, MEDIA_IMAGE_MIME };
