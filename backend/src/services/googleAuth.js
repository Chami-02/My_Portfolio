const { OAuth2Client } = require('google-auth-library');

/**
 * The Google boundary (PF-119) — the only file that talks to Google, the same
 * shape as `services/storage.js` for Cloudinary.
 *
 * Flow: OAuth 2.0 authorization code + PKCE, OpenID Connect for identity.
 * The code is exchanged HERE, with the client secret, so the secret never
 * reaches a browser; the ID token Google returns is then verified as if it
 * had come from anywhere — signature against Google's published keys, `iss`,
 * `aud`, `exp` (all inside `verifyIdToken`), then our `nonce` and Google's
 * `email_verified`.
 *
 * ⚠️ `verifyIdToken` SKIPS the audience check when `audience` is undefined
 * (oauth2client.js, `if (typeof requiredAudience !== 'undefined' …)`). That
 * is why a missing GOOGLE_CLIENT_ID is "unavailable" up front and never a
 * call with `undefined` — an unchecked audience accepts an ID token minted
 * for ANY Google app.
 *
 * ⚠️ The library's verification errors embed the whole token in `message`.
 * Callers get a `GoogleSignInError` with a reason code and nothing else; the
 * original is never logged.
 */

class GoogleSignInError extends Error {
  /** @param {'unavailable'|'failed'|'unverified'} reason */
  constructor(reason) {
    super(`Google sign-in ${reason}`);
    this.name   = 'GoogleSignInError';
    this.reason = reason;
  }
}

// Read at CALL time (sessionService's rule) so a test, or a fixed Vercel env,
// takes effect without a reload, and a missing value fails the same way
// everywhere.
const config = () => {
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri  = process.env.GOOGLE_REDIRECT_URI;
  return clientId && clientSecret && redirectUri
    ? { clientId, clientSecret, redirectUri }
    : null;
};

const isConfigured = () => config() !== null;

// One client per configuration. The client caches Google's signing keys for
// as long as Google's Cache-Control allows, so rebuilding it per request would
// refetch them on every sign-in.
let cached = { key: null, client: null };

/** Exported for tests, which inject a throwaway signing key into its cache. */
const getClient = () => {
  const cfg = config();
  if (!cfg) throw new GoogleSignInError('unavailable');
  const key = `${cfg.clientId}|${cfg.clientSecret}|${cfg.redirectUri}`;
  if (cached.key !== key) cached = { key, client: new OAuth2Client(cfg) };
  return cached.client;
};

/** A fresh PKCE pair: the verifier stays server-side, the challenge goes to Google. */
const createPkce = () => getClient().generateCodeVerifierAsync();

/**
 * Where to send the browser. `openid email` is the whole ask — no profile, no
 * Google APIs, nothing that needs Google's app verification review.
 * `select_account` so a browser signed in to several Google accounts chooses
 * deliberately instead of silently using the default one.
 */
const buildAuthUrl = ({ state, nonce, codeChallenge }) =>
  getClient().generateAuthUrl({
    scope:                 ['openid', 'email'],
    access_type:           'online',
    prompt:                'select_account',
    state,
    nonce,
    code_challenge_method: 'S256',
    code_challenge:        codeChallenge,
  });

/**
 * Exchange the authorization code and prove who signed in.
 *
 * @param {object}   args
 * @param {string}   args.code          from Google's redirect
 * @param {string}   args.codeVerifier  the PKCE verifier from the start step
 * @param {function} args.nonceMatches  (nonce) => boolean — the caller holds
 *                                      only the nonce's hash
 * @returns {Promise<{ sub: string, email: string }>} email lower-cased
 */
const verifyCode = async ({ code, codeVerifier, nonceMatches }) => {
  const client   = getClient();
  const { clientId } = config();

  let payload;
  try {
    const { tokens } = await client.getToken({ code, codeVerifier });
    if (!tokens?.id_token) throw new Error('no id_token');
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: clientId });
    payload = ticket.getPayload();
  } catch {
    // Deliberately swallowed — see the header: the message carries the token.
    throw new GoogleSignInError('failed');
  }

  if (typeof payload?.nonce !== 'string' || !nonceMatches(payload.nonce)) {
    throw new GoogleSignInError('failed');
  }
  // Strictly `true`. An unverified address proves nothing about who owns it,
  // and binding on it would let anyone who typed the owner's address into a
  // Google account sign in as the owner.
  if (payload.email_verified !== true || typeof payload.email !== 'string' || !payload.sub) {
    throw new GoogleSignInError('unverified');
  }

  return { sub: String(payload.sub), email: payload.email.trim().toLowerCase() };
};

module.exports = {
  GoogleSignInError,
  isConfigured,
  getClient,
  createPkce,
  buildAuthUrl,
  verifyCode,
};
