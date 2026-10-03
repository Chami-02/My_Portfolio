// frontend/src/utils/mediaFile.js
//
// The client half of every admin upload: the courtesy checks on a picked File,
// and the wording of a refused one. React-free.
//
// Moved out of AdminAboutPanel.jsx in PF-113, when the project card background
// became the third upload slot and the second panel to need them. A private copy
// per panel is how one of them drifts away from the server's own wording.
//
// ⚠️ THESE MIRROR THE SERVER AND ARE NOT THE GATE. `utils/fileType.js` (backend)
// decides by MAGIC BYTES; everything here reads `file.name` and `file.type`,
// both of which the client chooses. A .jpg renamed .pdf passes every check below
// and is refused with a 415 on SAVE, which is correct and must stay that way.

import { resizeImage, UndecodableImageError } from './resizeImage';

/** 4 MB — `MAX_IMAGE_BYTES` and `MAX_PDF_BYTES` (backend/src/middleware/upload.js).
 *  ⚠️ Never above 4 MB: Vercel refuses any request over 4.5 MB in production,
 *  and only production — localhost has no Vercel in front of it. */
export const MAX_UPLOAD_MB = 4;
const MAX_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/**
 * An image slot's spec — PNG / JPEG / WebP, 4 MB, and RESIZABLE.
 *
 * Was 2 MB until PF-113 batch 2. A photo over the limit is now shrunk in the
 * browser (utils/resizeImage.js) instead of refused, so the limit is a safety
 * margin rather than something the owner normally meets. The portrait and the
 * project background share it — both handlers check the same server constant.
 */
export const imageSpec = (label) => ({
  label,
  accept:   '.png,.jpg,.jpeg,.webp',
  maxBytes: MAX_BYTES,
  resizable: true,
  looksRight: (f) =>
    ['image/png', 'image/jpeg', 'image/webp'].includes(f.type) ||
    /\.(png|jpe?g|webp)$/i.test(f.name),
  typeMessage: `${label} must be a PNG, JPEG or WEBP image.`,
});

export const formatBytes = (bytes) =>
  !bytes ? ''
    : bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export const rejectReason = (file, spec) => {
  if (!spec.looksRight(file)) return spec.typeMessage;
  if (file.size > spec.maxBytes) {
    return `${spec.label} is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ` +
           `${spec.maxBytes / 1024 / 1024} MB.`;
  }
  return null;
};

/**
 * Turn a failed mutation into something an operator can act on.
 *
 * The server already separates 415 / 413 / 503 with distinct messages
 * (aboutController.js), so its own text is used verbatim — three statuses, three
 * sentences, not one catch-all. The 503 gets an addition because its message
 * describes the server's state without saying that the operator is not the
 * person who can fix it.
 *
 * ⚠️ The `!err.response` branch is the one that would otherwise collapse into
 * the others — a dead backend and a rejected file are different problems, and
 * `utils/loginError.js` exists because that exact conflation shipped once.
 */
export const messageFor = (err) => {
  const status = err?.response?.status;
  const message = err?.response?.data?.message;
  if (!err?.response) return 'the server could not be reached — check your connection and try again.';
  if (status === 503) {
    return `${message || 'file storage is unavailable.'} Nothing can be done from this panel — ` +
           'the storage keys are missing on the server.';
  }
  return message || 'the request was rejected.';
};

/** The résumé's spec — PDF, 4 MB. Not resizable: a PDF cannot be shrunk here. */
export const RESUME_SPEC = {
  label:    'Résumé',
  accept:   '.pdf',
  maxBytes: MAX_BYTES,
  resizable: false,
  looksRight: (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name),
  typeMessage: 'Résumé must be a PDF.',
};

/**
 * Everything that happens between "a file arrived" and "it is staged" — the
 * ONE path for both the upload button and a drag-and-drop (PF-113 batch 2).
 *
 * ⚠️ One path is the point. A drop BYPASSES the picker's `accept` filter, so a
 * dropped .svg or .heic reaches here unfiltered; if drops took a shortcut, the
 * type check would exist only for the button.
 *
 * @returns {Promise<{ file: File, resizedFrom: number|null } | { error: string }>}
 */
export async function prepareFile(file, spec) {
  if (!spec.looksRight(file)) return { error: spec.typeMessage };

  let out = file;
  let resizedFrom = null;

  if (spec.resizable) {
    try {
      const result = await resizeImage(file, { maxBytes: spec.maxBytes });
      if (result.resized) { out = result.file; resizedFrom = file.size; }
    } catch (err) {
      if (!(err instanceof UndecodableImageError)) throw err;
      // The browser cannot read it (e.g. HEIC in Chrome). A small one may
      // still be a perfectly good upload — the server decides by its bytes —
      // but an oversized one can neither be shrunk nor sent.
      if (file.size > spec.maxBytes) {
        return { error: `${spec.label} is too large to send and could not be opened for resizing — export it as JPEG or PNG and try again.` };
      }
    }
  }

  const reason = rejectReason(out, spec);
  return reason ? { error: reason } : { file: out, resizedFrom };
}

