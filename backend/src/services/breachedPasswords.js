const crypto = require('crypto');

// ── Leaked-password check (PF-125, owner 2026-10-26) ─────────────────────────
// NIST SP 800-63B: a new password must be checked against passwords known
// from data breaches. Have I Been Pwned's range API is free and needs no key.
//
// k-anonymity: only the first 5 hex characters of the password's SHA-1 leave
// this server. The API answers with every leaked hash that starts with them
// (hundreds), and the match happens HERE. `Add-Padding` makes every answer
// the same size, so not even the response length says anything.
//
// FAILS OPEN: if the service is down, slow or answers oddly, the check is
// skipped (logged) and the password is accepted. A reset must never depend on
// a third party being up — the length rule still applies either way.

const RANGE_URL  = 'https://api.pwnedpasswords.com/range/';
const TIMEOUT_MS = 3000;

/**
 * true  — the password appears in a known breach;
 * false — it does not;
 * null  — the check could not run (the caller accepts the password).
 */
const isBreached = async (password) => {
  // ⚠️ SHA-1 is HIBP's format, not password STORAGE: the hash is never kept,
  // only its first 5 characters leave the server, and the stored password is
  // bcrypt cost 12 (User.js). CodeQL's js/insufficient-password-hash flags
  // this line; it was dismissed on GitHub as a false positive (PF-125).
  const sha1   = crypto.createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  try {
    const res = await fetch(RANGE_URL + prefix, {
      headers: { 'Add-Padding': 'true', 'User-Agent': 'portfolio-backend' },
      signal:  AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.text();
    // Lines are "SUFFIX:COUNT"; padding lines have a count of 0.
    return body.split('\n').some((line) => {
      const [hash, count] = line.trim().split(':');
      return hash === suffix && Number(count) > 0;
    });
  } catch (err) {
    console.warn(`[PF-125] Leaked-password check skipped: ${err.name} ${err.message}`);
    return null;
  }
};

module.exports = { isBreached };
