const {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} = require('@simplewebauthn/server');

// ── Passkeys (PF-140): the WebAuthn half ─────────────────────────────────────
// Standards: W3C WebAuthn Level 3 (§7.1 and §7.2 are the checks the library
// makes); OWASP MFA Cheat Sheet (require user verification and check the flag).
//
//   - `userVerification: 'required'`: this door stands alone, with no password
//     beside it, so the device must have checked the person, not just its own
//     presence. Which check (fingerprint, face, PIN) is the device's choice; a
//     website can neither pick it nor see it.
//   - `residentKey: 'required'`: the passkey names its own account, so nobody
//     types an address and the page cannot be used to probe addresses (§14.6.2).
//   - `attestationType: 'none'`: no list of approved devices to enforce.

const RP_NAME = 'Parindra Gallage';

// The recommended default for a ceremony (WebAuthn §15). The library's own
// default of 60 s is short for someone finding their phone.
const PROMPT_TIMEOUT_MS = 5 * 60 * 1000;

// Top of the same section's 5–10 minute range, as §13.4.3 asks of a challenge.
const CHALLENGE_TTL_MS = 10 * 60 * 1000;

/**
 * Who a passkey is for. It comes from FRONTEND_URL, never from the request: the
 * whole point is that the browser's real address must match this exact value.
 * Read at call time. Null when unset, and every route then refuses.
 */
const relyingParty = () => {
  try {
    const { origin, hostname } = new URL(process.env.FRONTEND_URL);
    return { origin, rpID: hostname };
  } catch {
    return null;
  }
};

/** Opaque and stable: the account id, never an address (WebAuthn §14.6.1). */
const userHandleOf = (user) => Buffer.from(String(user._id));

const loginOptions = (rp) =>
  generateAuthenticationOptions({
    rpID:             rp.rpID,
    userVerification: 'required',
    timeout:          PROMPT_TIMEOUT_MS,
  });

const registerOptions = (rp, user, existing) =>
  generateRegistrationOptions({
    rpName:          RP_NAME,
    rpID:            rp.rpID,
    userName:        user.email,
    userID:          userHandleOf(user),
    attestationType: 'none',
    timeout:         PROMPT_TIMEOUT_MS,
    // A device already holding one of these is told not to make a second.
    excludeCredentials: existing.map((p) => ({ id: p.credentialId, transports: p.transports })),
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
  });

/**
 * Both verifiers THROW on most refusals (wrong address, wrong challenge, a
 * counter going backwards) and return `verified: false` on the rest. Callers
 * want one answer: the result, or null. The reason goes to the log only; the
 * visitor is told the same thing for all of them.
 */
const verified = async (check) => {
  try {
    const result = await check();
    return result.verified ? result : null;
  } catch (err) {
    console.warn(`[PF-140] Passkey refused: ${err.message}`);
    return null;
  }
};

const verifyLogin = (rp, response, expectedChallenge, passkey) =>
  verified(() => verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: rp.origin,
    expectedRPID:   rp.rpID,
    requireUserVerification: true,
    credential: {
      id:         passkey.credentialId,
      publicKey:  new Uint8Array(passkey.publicKey),
      counter:    passkey.counter,
      transports: passkey.transports,
    },
  }));

const verifyRegistration = (rp, response, expectedChallenge) =>
  verified(() => verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: rp.origin,
    expectedRPID:   rp.rpID,
    requireUserVerification: true,
  }));

/**
 * WebAuthn §7.2: when the device names an account, it must be the passkey's
 * owner. It is optional in the protocol, and missing is allowed.
 */
const handleMatches = (response, user) => {
  const handle = response?.response?.userHandle;
  return handle === undefined || handle === null || handle === userHandleOf(user).toString('base64url');
};

module.exports = {
  CHALLENGE_TTL_MS,
  relyingParty,
  loginOptions,
  registerOptions,
  verifyLogin,
  verifyRegistration,
  handleMatches,
};
