import api from './api';
import { multipart } from './multipart';

/**
 * A restore replaces the whole site in one transaction, after reading and
 * checking every row; on a cold serverless start that can outlast api.js's
 * 12-second default. One minute, for these two calls only.
 */
const SLOW = 60_000;

/** The backup file + password, as the multipart form the backend reads. */
const restoreForm = (file, password) => {
  const [fd, config] = multipart(file);
  if (password !== undefined) fd.append('password', password);
  return [fd, { ...config, timeout: SLOW }];
};

export const backupService = {
  /**
   * PF-135 — everything the site says, as one object, plus `problems`: the
   * download checks itself, and a non-empty list means this file would not
   * restore until those rows are fixed. Needs the current password (OWASP
   * ASVS 5.0 V7.5); a wrong one is a 400, never a 401.
   */
  download: ({ password }) =>
    api.post('/backup', { password })
      .then((r) => ({ backup: r.data.data, problems: r.data.problems ?? [] })),

  /** The preview: checks the file, changes nothing. A 422 carries `problems`. */
  checkRestore: (file) =>
    api.post('/backup/restore/check', ...restoreForm(file)).then((r) => r.data.data),

  /** Replace the site's content with the file (safety copy first, messages merged). */
  restore: ({ file, password }) =>
    api.post('/backup/restore', ...restoreForm(file, password)).then((r) => r.data.data),

  /** The safety copies, newest first: id, createdAt, counts — no content. */
  listSafetyCopies: () => api.get('/backup/safety').then((r) => r.data.data),

  /** One safety copy, as a backup file. Needs the current password. */
  downloadSafetyCopy: ({ id, password }) =>
    api.post(`/backup/safety/${id}`, { password }).then((r) => r.data.data),
};
