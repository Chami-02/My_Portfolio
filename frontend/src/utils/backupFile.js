// frontend/src/utils/backupFile.js
//
// PF-135 — turning the backup the server sent into a file the browser saves.
// React-free, so the name and the save are unit-tested on their own.

const pad = (n) => String(n).padStart(2, '0');

/**
 * `portfolio-backup-2026-10-30.json` — the reader's LOCAL date (dates stay
 * reader-local, locked), so a backup made at 01:00 in Colombo is not
 * named after yesterday.
 */
export const backupFileName = (iso, kind = 'backup') => {
  const d = new Date(iso);
  return `portfolio-${kind}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
};

/** The largest file the server accepts (backend middleware/upload.js). */
export const MAX_BACKUP_BYTES = 4 * 1024 * 1024;

/**
 * A COURTESY check before the file is sent — the server's checks are the
 * gate. Catches the obvious wrong pick (a photo, a huge file) without a
 * request. Returns the reason, or null.
 */
export const backupPickProblem = (file) => {
  if (!/\.json$/i.test(file.name)) return 'Choose the .json file that DOWNLOAD BACKUP saved.';
  if (file.size > MAX_BACKUP_BYTES) return 'That file is bigger than 4 MB — a backup is far smaller. Choose the file DOWNLOAD BACKUP saved.';
  return null;
};

/** How long the object URL outlives the click — FileSaver.js's figure. */
export const REVOKE_AFTER_MS = 40_000;

/**
 * Save `data` as a pretty-printed JSON file: a Blob behind an object URL,
 * clicked through a detached `<a download>`.
 *
 * ⚠️ The URL is released LATER, not straight after the click: Safari starts
 * reading the Blob after `click()` returns, and a URL revoked first saves
 * nothing. FileSaver.js waits 40 s for the same reason.
 */
export const saveJson = (data, fileName) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
};
