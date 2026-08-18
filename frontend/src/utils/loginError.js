// frontend/src/utils/loginError.js

/**
 * Turn an axios failure from the login request into a message the reader
 * can act on. React-free, like the rest of utils/, so it is unit-testable
 * without rendering the page.
 *
 * ── Why this exists ───────────────────────────────────────────────────
 *
 * AdminLoginPage used to build the message inline:
 *
 *     err.response?.data?.message || 'Invalid email or password. Please try again.'
 *
 * That collapsed every failure mode into one sentence — including the one
 * where the request never reached a server at all. A backend that is
 * simply not running looked identical to a wrong password, and the only
 * tell was the trailing "Please try again.", which the API never sends:
 * authController.js replies with a bare 'Invalid email or password'. So
 * the fallback string was the signal, and it read like a credential
 * rejection.
 *
 * That ambiguity cost a real debugging session on 2026-08-18 — nothing
 * was listening on port 5050, and the form blamed the password.
 *
 * The branches below are genuinely different problems with different
 * fixes, so they get different sentences.
 */
export function loginErrorMessage(err) {
  // No response object at all: connection refused, DNS failure, CORS
  // rejection or timeout. The credentials were never even checked, so
  // saying anything about them is actively misleading.
  if (!err?.response) {
    if (err?.code === 'ECONNABORTED') {
      return 'The server took too long to respond. Is the backend running?';
    }
    return 'Cannot reach the server — it may not be running. '
         + 'Start the backend, then try again.';
  }

  // The only status that is actually about the credentials.
  if (err.response.status === 401) {
    return 'Invalid email or password. Please try again.';
  }

  // Any other HTTP failure: surface what the server said, and fall back to
  // the status code rather than to a credential message.
  return err.response.data?.message
      || `Sign-in failed (HTTP ${err.response.status}). Please try again.`;
}
