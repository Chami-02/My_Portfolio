// frontend/src/utils/passkeyError.js
//
// PF-140 — what to say when a passkey attempt stops. React-free, like
// loginError.js. Two kinds of failure reach here, with different next steps:
// the DEVICE stopped (no `isAxiosError`), or the request got an answer or none.
import { friendlyError } from './friendlyError';

const fromDevice = (err) => !err?.isAxiosError;

/**
 * The person closed the prompt, or it timed out. Browsers give these one name
 * on purpose, so a page cannot tell whether a passkey exists. Not a failure:
 * the page says so quietly, and the server never hears of it.
 */
export const passkeyCancelled = (err) =>
  fromDevice(err) && (err?.name === 'NotAllowedError' || err?.name === 'AbortError');

const SIGN_IN_FALLBACK = "We couldn't sign you in with a passkey. Please try again, or use your password or Google.";

export function passkeySignInMessage(err) {
  if (passkeyCancelled(err)) {
    return 'Passkey sign-in was cancelled. Try again, or use your password or Google.';
  }
  if (fromDevice(err)) return SIGN_IN_FALLBACK;
  return friendlyError(err, { fallback: SIGN_IN_FALLBACK });
}

export function passkeyAddMessage(err) {
  if (passkeyCancelled(err)) return 'Adding the passkey was cancelled. Press CREATE PASSKEY to try again.';
  // `excludeCredentials` did its job: this device already holds one of them.
  if (fromDevice(err) && err?.name === 'InvalidStateError') return 'This device already has a passkey for your account.';
  if (fromDevice(err)) return "Your device couldn't make a passkey. Please try again.";
  return friendlyError(err, { fallback: "We couldn't add that passkey. Please try again." });
}
