const nodemailer = require('nodemailer');

// ── Mailer service (PF-123, Resend since PF-148) ─────────────────────────────
// One adapter object, like storage.js: nothing else in the app imports
// nodemailer. Resend's SMTP service with an API key.
//
// Blank RESEND_API_KEY = mail is OFF. Callers check isConfigured() and carry
// on without it (the contact form still saves).
//
// Read lazily rather than at module load: the tests change the environment
// between cases, and a captured constant would go stale.
const apiKey = () => process.env.RESEND_API_KEY || '';

// The subdomain verified at Resend. These are sending names, not mailboxes.
const SENDERS = Object.freeze({
  security: { name: 'Portfolio security', address: 'no-reply@mail.parindragallage.com' },
  contact:  { name: 'Portfolio',          address: 'contact@mail.parindragallage.com' },
});

// Short on purpose. The send runs in the background (waitUntil), and a hung
// connection would otherwise hold the function open until Vercel kills it.
const TIMEOUT_MS = 10_000;

const mailer = {

  isConfigured: () => Boolean(apiKey()),

  /**
   * Send one email: `text`, plus an optional `html` version of the same
   * content (multipart — a client shows whichever it supports).
   *
   * Security is the default sender, so only the contact email has to ask for
   * anything else. Every email is marked as machine-written (RFC 3834), which
   * tells vacation auto-replies not to answer it.
   *
   * ⚠️ A caller that puts visitor-written content into `html` must ESCAPE
   * it first (contactController's `escapeHtml`), or a message could carry
   * markup or disguised links.
   *
   * Rejects on failure. A caller that logs the error must log `code` and
   * `message` only — never the error object, which carries the transport.
   *
   * @param {{to: string, subject: string, text: string, html?: string, replyTo?: string, sender?: 'security'|'contact'}} mail
   */
  send({ to, subject, text, html, replyTo, sender = 'security' }) {
    const transport = nodemailer.createTransport({
      host:   'smtp.resend.com',
      port:   465,
      secure: true,
      auth:   { user: 'resend', pass: apiKey() },
      connectionTimeout: TIMEOUT_MS,
      greetingTimeout:   TIMEOUT_MS,
      socketTimeout:     TIMEOUT_MS,
    });
    return transport.sendMail({
      from: SENDERS[sender],
      to, subject, text, html, replyTo,
      headers: { 'Auto-Submitted': 'auto-generated' },
    });
  },
};

module.exports = mailer;
