const nodemailer = require('nodemailer');

// ── Mailer service (PF-123) ──────────────────────────────────────────────────
// One adapter object, like storage.js: nothing else in the app imports
// nodemailer. Gmail SMTP with an app password today; Resend once the custom
// domain exists — that swap changes this file and the env, nothing else.
//
// Blank GMAIL_USER / GMAIL_APP_PASSWORD = mail is OFF. Callers check
// isConfigured() and carry on without it (the contact form still saves).
//
// Read lazily rather than at module load: the tests change the environment
// between cases, and a captured constant would go stale.
const user     = () => process.env.GMAIL_USER || '';
const password = () => process.env.GMAIL_APP_PASSWORD || '';

// Short on purpose. The send runs in the background (waitUntil), and a hung
// connection would otherwise hold the function open until Vercel kills it.
const TIMEOUT_MS = 10_000;

const mailer = {

  isConfigured: () => Boolean(user() && password()),

  /** The account mail is sent from — also the owner's inbox (PF-119). */
  address: user,

  /**
   * Send one email: `text`, plus an optional `html` version of the same
   * content (multipart — a client shows whichever it supports).
   *
   * ⚠️ A caller that puts visitor-written content into `html` must ESCAPE
   * it first (contactController's `escapeHtml`), or a message could carry
   * markup or disguised links.
   *
   * Rejects on failure. A caller that logs the error must log `code` and
   * `message` only — never the error object, which carries the transport.
   *
   * @param {{to: string, subject: string, text: string, html?: string, replyTo?: string}} mail
   */
  send({ to, subject, text, html, replyTo }) {
    const transport = nodemailer.createTransport({
      host:   'smtp.gmail.com',
      port:   465,
      secure: true,
      auth:   { user: user(), pass: password() },
      connectionTimeout: TIMEOUT_MS,
      greetingTimeout:   TIMEOUT_MS,
      socketTimeout:     TIMEOUT_MS,
    });
    return transport.sendMail({ from: { name: 'Portfolio', address: user() }, to, subject, text, html, replyTo });
  },
};

module.exports = mailer;
