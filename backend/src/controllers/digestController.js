const crypto      = require('crypto');
const SignInEvent = require('../models/SignInEvent');
const User        = require('../models/User');
const AppError    = require('../utils/AppError');
const mailer      = require('../services/mailer');
const { renderAlert } = require('../services/alertEmail');
const { NOT_YOU_STEPS, adminAction } = require('../services/signInLog');

// ══ The daily digest (PF-133, owner 2026-10-26 / 2026-10-29) ══════════════════
//
// Once a day Vercel Cron calls GET /api/cron/digest. If anything FAILED since
// the last digest — wrong passwords, refused Google accounts, reset requests
// for addresses that match no account — ONE email to the main address says
// so. A quiet day sends nothing.
//
// Why a digest and not an email per attempt: both admin addresses are public,
// so anyone can make failures happen. One email each would flood the inbox,
// spend Gmail's daily sending quota (shared with the contact form and the
// codes), and teach the owner to ignore security email (alert fatigue).
//
// Who may call it: Vercel sends `Authorization: Bearer <CRON_SECRET>` when the
// project has that variable. Anything else is refused; with no secret set the
// route is off (401) — it never runs unauthenticated.
//
// Exactly once: a run CLAIMS the failed rows it reports (stamps them with its
// own id in one update), then reads back only what it claimed. Vercel may
// deliver a cron call twice; the second run claims nothing and sends nothing.

const SHOWN = 10;

const KIND_TEXT = {
  'sign-in':         'Failed sign-in',
  'reset-request':   'Reset code requested for an unknown address',
  // PF-135 — refused by the password re-check, so someone was SIGNED IN.
  'backup-download': 'Backup download — wrong password',
  'backup-restore':  'Backup restore — wrong password',
};

const sameSecret = (given, expected) => {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const isCron = (req) => {
  const secret = process.env.CRON_SECRET || '';
  return secret.length > 0 && sameSecret(req.get('authorization') || '', `Bearer ${secret}`);
};

/** "2026-10-29 14:05 UTC" — the email has no reader time zone to go by. */
const utc = (date) => `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;

const line = (row) => [
  KIND_TEXT[row.kind] ?? row.kind,
  row.address,
  row.device,
  row.location && `${row.location} (approx.)`,
].filter(Boolean).join(' · ');

// ── GET /api/cron/digest ──────────────────────────────────────────────────────
const sendDigest = async (req, res, next) => {
  try {
    if (!isCron(req)) return next(new AppError('Not allowed.', 401));

    // With mail off nothing is claimed — the rows wait for a run that can send.
    if (!mailer.isConfigured()) return res.json({ status: 'success', sent: false, reason: 'mail-off' });

    const owner = await User.findOne().sort({ createdAt: 1 }).select('email').lean();
    if (!owner) return res.json({ status: 'success', sent: false, reason: 'no-account' });

    const run = crypto.randomUUID();
    await SignInEvent.updateMany(
      { outcome: 'failed', digestedAt: null },
      { $set: { digestedAt: new Date(), digestRun: run } },
    );
    const rows = await SignInEvent.find({ digestRun: run }).sort({ createdAt: -1 }).lean();
    if (rows.length === 0) return res.json({ status: 'success', sent: false, reason: 'quiet' });

    const signIns = rows.filter((r) => r.kind === 'sign-in').length;
    const resets  = rows.filter((r) => r.kind === 'reset-request').length;
    // PF-135 — a wrong password on a backup route comes from a signed-in
    // session, so it gets its own sentence rather than hiding in a count.
    const backups = rows.length - signIns - resets;
    const backupText = backups === 0 ? '' : ` ${backups} backup download or restore attempt${backups === 1 ? '' : 's'} had the wrong password — someone signed in to your admin tried it.`;
    const details = rows.slice(0, SHOWN).map((row) => [utc(row.createdAt), line(row)]);
    if (rows.length > SHOWN) details.push(['…', `${rows.length - SHOWN} more in Settings → Sessions`]);

    try {
      await mailer.send({
        to:      owner.email,
        subject: `Admin activity: ${rows.length} failed attempt${rows.length === 1 ? '' : 's'} since the last summary`,
        ...renderAlert({
          tone:  'warning',
          title: 'Failed attempts on your admin',
          intro: `Since the last summary: ${signIns} failed sign-in${signIns === 1 ? '' : 's'} and ${resets} reset request${resets === 1 ? '' : 's'} for unknown addresses. Nobody got in through these — each one was refused.${backupText}`,
          details,
          note:   'A few a day is normal: the addresses are public.',
          steps:  NOT_YOU_STEPS,
          action: adminAction(),
        }),
      });
    } catch (err) {
      // Give the rows back so tomorrow's run reports them. code + message only.
      await SignInEvent.updateMany({ digestRun: run }, { $set: { digestedAt: null }, $unset: { digestRun: 1 } });
      console.error(`[PF-133] Digest email failed: ${err.code || ''} ${err.message}`);
      return res.json({ status: 'success', sent: false, reason: 'send-failed' });
    }

    res.json({ status: 'success', sent: true, count: rows.length });
  } catch (err) {
    next(err);
  }
};

module.exports = { sendDigest };
