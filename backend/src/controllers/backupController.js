const mongoose       = require('mongoose');
const { waitUntil }  = require('@vercel/functions');
const BackupSnapshot = require('../models/BackupSnapshot');
const AppError       = require('../utils/AppError');
const mailer         = require('../services/mailer');
const { renderAlert } = require('../services/alertEmail');
const { recordEvent, NOT_YOU_STEPS, adminAction } = require('../services/signInLog');
const { signedInAddress } = require('../services/sessionService');
const { buildBackup, validateBackup, restoreBackup } = require('../services/backupFile');
const { WRONG_PASSWORD, passwordRule, checkPassword } = require('../utils/passwordCheck');
const { deviceLabel }     = require('../utils/deviceLabel');
const { requestLocation } = require('../utils/requestLocation');

// PF-135 — the Settings Backup card: download everything the site says as
// one JSON file, and restore such a file. The file logic lives in
// services/backupFile.js; this file is the HTTP side.
//
// Standards:
//   - OWASP ASVS 5.0 V7.5 — authenticate AGAIN before a sensitive action:
//     every route that hands out content (download, safety copy) or replaces
//     it (restore) takes the current password (owner's choice, 2026-10-30).
//     A refusal is 400, never 401 (the PF-124 rule: a 401 signs the client
//     out, a mistyped password must not).
//   - POST, never GET, for anything carrying the password: URLs land in logs
//     and browser history.
//   - Validate → preview → confirm → execute: /restore/check writes nothing;
//     /restore checks the file AGAIN and never trusts the earlier answer.
//   - OWASP Logging (ASVS 5.0 V16): every download and restore, ok or
//     refused, goes into the sign-in history; a restore also emails the owner,
//     as a password change does.

const backupRules = [passwordRule];

const UNREADABLE = 'That file could not be read as a backup — choose the .json file DOWNLOAD BACKUP saved.';

/** 422 with the list: the request was understood, the file cannot be restored. */
const refuse = (res, problems) => res.status(422).json({
  status:  'fail',
  message: 'This backup cannot be restored. Nothing was changed.',
  problems,
});

/** The uploaded file as parsed JSON, or null when it is not JSON at all. */
const readUpload = (req) => {
  if (!req.file) throw new AppError('Choose a backup file to restore.', 400);
  try {
    return JSON.parse(req.file.buffer.toString('utf8'));
  } catch {
    return null;
  }
};

/** Log a refused password, then answer 400. */
const wrongPassword = async (req, next, kind) => {
  await recordEvent(req, { user: req.user, kind, outcome: 'failed' });
  return next(new AppError(WRONG_PASSWORD, 400));
};

// ── POST /api/backup ──────────────────────────────────────────────────────────
// The file, plus `problems`: the download checks ITSELF (guard 1 of the
// restore standard — a file the owner keeps is known to restore). A file
// with problems is still sent — it is still the owner's data — and the card
// says what to fix before it can be restored. The check reads a JSON
// round-trip of the file, exactly what a restore would receive.
const downloadBackup = async (req, res, next) => {
  try {
    if (!(await checkPassword(req))) return wrongPassword(req, next, 'backup-download');

    const backup = await buildBackup();
    const { problems } = await validateBackup(JSON.parse(JSON.stringify(backup)));
    await recordEvent(req, { user: req.user, kind: 'backup-download', outcome: 'ok' });
    res.json({ status: 'success', data: backup, problems });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/backup/restore/check ────────────────────────────────────────────
// The preview. Changes NOTHING — no password, because it reveals nothing:
// it only reads back the file the caller already holds.
const checkRestore = async (req, res, next) => {
  try {
    const input = readUpload(req);
    if (input === null) return refuse(res, [UNREADABLE]);
    const { problems, summary } = await validateBackup(input);
    if (problems.length) return refuse(res, problems);
    res.json({ status: 'success', data: summary });
  } catch (err) {
    next(err);
  }
};

const restoreAlert = (req, sentTo, summary, result) => {
  const c = result.counts;
  return {
    to:      [...new Set([req.user.email, sentTo])],
    subject: 'Your site was restored from a backup',
    ...renderAlert({
      tone:    'warning',
      title:   'Your site was restored from a backup',
      intro:   'Someone signed in to your admin replaced the site’s content with a backup file. A safety copy of the content before the restore is kept in Settings → Backup.',
      details: [
        ['Signed in as', sentTo],
        ['Device', deviceLabel(req.get('user-agent'))],
        ...(requestLocation(req) ? [['From', `${requestLocation(req)} (approx.)`]] : []),
        ...(summary.createdAt ? [['Backup made', new Date(summary.createdAt).toUTCString()]] : []),
        ['Restored', `${c.projects} projects · ${c.skills} skills · ${c.skillCategories} sections · ${c.blog} posts · ${c.vocabulary} tags & tech`],
        ['Messages', `${result.messagesAdded} brought back; none deleted`],
      ],
      note:   'If this was you, there is nothing to do.',
      steps:  NOT_YOU_STEPS,
      action: adminAction(),
    }),
  };
};

/** Background, after the response: a failed email never fails the restore. */
const sendRestoreAlert = async (message) => {
  try {
    await mailer.send(message);
  } catch (err) {
    // code + message only: the error object carries the transport (PF-123).
    console.error(`[PF-135] Restore email failed: ${err.code || ''} ${err.message}`);
  }
};

// ── POST /api/backup/restore ──────────────────────────────────────────────────
// Password → the file checked AGAIN → one transaction (safety copy, content
// replaced, messages merged) → logged → the owner emailed.
const restore = async (req, res, next) => {
  try {
    if (!(await checkPassword(req))) return wrongPassword(req, next, 'backup-restore');

    const input = readUpload(req);
    if (input === null) return refuse(res, [UNREADABLE]);
    const { problems, rows, summary } = await validateBackup(input);
    if (problems.length) return refuse(res, problems);

    const result = await restoreBackup(rows);
    await recordEvent(req, { user: req.user, kind: 'backup-restore', outcome: 'ok' });
    if (mailer.isConfigured()) {
      waitUntil(sendRestoreAlert(restoreAlert(req, await signedInAddress(req), summary, result)));
    }
    res.json({
      status: 'success',
      data: {
        backupCreatedAt: summary.createdAt,
        counts:          result.counts,
        messagesAdded:   result.messagesAdded,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/backup/safety ────────────────────────────────────────────────────
// The safety copies, newest first — when and how much, never the content.
const listSafetyCopies = async (_req, res, next) => {
  try {
    const rows = await BackupSnapshot.find().sort({ createdAt: -1, _id: -1 })
      .select('createdAt counts reason').lean();
    res.json({
      status: 'success',
      data: rows.map((row) => ({ id: row._id, createdAt: row.createdAt, counts: row.counts, reason: row.reason })),
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/backup/safety/:id ───────────────────────────────────────────────
// One safety copy, as a backup file. It holds messages too, so the same
// password re-check and the same log entry as a download.
const downloadSafetyCopy = async (req, res, next) => {
  try {
    if (!(await checkPassword(req))) return wrongPassword(req, next, 'backup-download');
    if (!mongoose.isValidObjectId(req.params.id)) return next(new AppError('That safety copy no longer exists.', 404));

    const copy = await BackupSnapshot.findById(req.params.id).select('data').lean();
    if (!copy) return next(new AppError('That safety copy no longer exists.', 404));
    await recordEvent(req, { user: req.user, kind: 'backup-download', outcome: 'ok' });
    res.json({ status: 'success', data: JSON.parse(copy.data) });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  backupRules, downloadBackup, checkRestore, restore, listSafetyCopies, downloadSafetyCopy,
};
