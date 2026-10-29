// PF-133 — the test runner must leave mail OFF, even on a machine whose
// backend/.env holds the real Gmail app password.
//
// The trap: run-jest used to DELETE the keys, and app.js's own
// `require('dotenv').config()` (run again in every worker) re-added them with
// the real values — local runs sent real mail for months. Loading the app here
// reproduces that second dotenv pass; the keys must still be BLANK after it.
// Blank (not absent) also on CI, where there is no .env: run-jest sets them.
const mailer = require('../services/mailer');

it('the test runner leaves mail OFF, even after app.js reloads .env', () => {
  require('../app');
  expect(process.env.GMAIL_USER).toBe('');
  expect(process.env.GMAIL_APP_PASSWORD).toBe('');
  expect(process.env.CRON_SECRET).toBe('');
  expect(mailer.isConfigured()).toBe(false);
});
