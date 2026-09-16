const crypto   = require('crypto');
const jwt      = require('jsonwebtoken');
const Session  = require('../models/Session');
const User     = require('../models/User');
const AppError = require('../utils/AppError');

/**
 * The ONE session model (PF-108).
 *
 * Every way of signing in — password today, Google in PF-119 — ends in
 * `issueSession(user)`, and every way of signing out ends in one of the
 * `revoke*` functions. Nothing else in the codebase signs a JWT.
 *
 * Shape:
 *   - a SHORT-LIVED access JWT (`ACCESS_TOKEN_TTL`, default 15 minutes) that
 *     the client holds in memory and sends as `Authorization: Bearer`;
 *   - an OPAQUE refresh token (32 random bytes) that the client stores and
 *     presents to `POST /api/auth/refresh` when the access token dies. Only
 *     its SHA-256 is stored server-side.
 *
 * Rotation with reuse detection: every refresh revokes the token presented
 * and issues a successor in the same `family`. If a token that has ALREADY
 * been rotated is presented again, someone holds a copy that the legitimate
 * client no longer has — so the whole family is revoked and both parties are
 * signed out. That is the standard trade for a browser app that cannot use
 * an httpOnly cookie (frontend and backend are different sites on
 * vercel.app): not prevention of theft, but detection on first use.
 *
 * ⚠️ Read the TTL env vars at CALL time, not module load, so a test can set
 * them per case and so a missing value falls back the same way everywhere.
 */

const accessTtl = () => process.env.ACCESS_TOKEN_TTL || '15m';

const refreshTtlMs = () => {
  const days = Number(process.env.REFRESH_TOKEN_TTL_DAYS);
  return (Number.isFinite(days) && days > 0 ? days : 7) * 24 * 60 * 60 * 1000;
};

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

const SESSION_ENDED = 'Your session has ended. Please log in again.';

/**
 * Create a fresh refresh-token row for `user` and sign an access token that
 * names its family. `family` is only passed by `rotateSession`; a login
 * starts a new one.
 */
const issueSession = async (user, family = crypto.randomUUID()) => {
  const refreshToken     = crypto.randomBytes(32).toString('base64url');
  const refreshExpiresAt = new Date(Date.now() + refreshTtlMs());

  const session = await Session.create({
    user:      user._id,
    tokenHash: hashToken(refreshToken),
    family,
    expiresAt: refreshExpiresAt,
  });

  const accessToken = jwt.sign(
    { id: user._id, fam: family },
    process.env.JWT_SECRET,
    { expiresIn: accessTtl() }
  );
  // Read the expiry back off the signed token rather than recomputing it, so
  // the number the client is told is the number `protect` will enforce.
  const accessExpiresAt = new Date(jwt.decode(accessToken).exp * 1000);

  return {
    accessToken,
    refreshToken,
    accessExpiresAt:  accessExpiresAt.toISOString(),
    refreshExpiresAt: refreshExpiresAt.toISOString(),
    sessionId:        session._id,
  };
};

/**
 * Exchange a refresh token for a new access + refresh pair, revoking the one
 * presented. Throws a 401 AppError for every failure — the client treats
 * them all the same way (clear the session, go to login), and a more
 * specific message would only tell an attacker which part they got right.
 */
const rotateSession = async (refreshToken) => {
  if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
    throw new AppError('Refresh token required.', 401);
  }

  const now     = new Date();
  const session = await Session.findOne({ tokenHash: hashToken(refreshToken) });

  if (!session) {
    throw new AppError(SESSION_ENDED, 401);
  }

  // Reuse: this token was already rotated (or revoked by logout). Someone is
  // presenting a copy the real client no longer holds. Kill the family.
  if (session.revokedAt) {
    await Session.updateMany(
      { family: session.family, revokedAt: null },
      { $set: { revokedAt: now } }
    );
    throw new AppError(SESSION_ENDED, 401);
  }

  if (session.expiresAt <= now) {
    throw new AppError(SESSION_ENDED, 401);
  }

  // Atomic claim. Two requests racing with the same token (two tabs) both
  // pass the reads above; only one wins this update. The loser sees `null`
  // and is treated as reuse — the family dies, both tabs go to login. For a
  // single operator that is the correct, conservative outcome.
  const claimed = await Session.findOneAndUpdate(
    { _id: session._id, revokedAt: null },
    { $set: { revokedAt: now } },
    { new: true }
  );
  if (!claimed) {
    await Session.updateMany(
      { family: session.family, revokedAt: null },
      { $set: { revokedAt: now } }
    );
    throw new AppError(SESSION_ENDED, 401);
  }

  const user = await User.findById(session.user);
  if (!user) {
    throw new AppError('The user belonging to this session no longer exists.', 401);
  }

  const next = await issueSession(user, session.family);
  claimed.replacedBy = next.sessionId;
  await claimed.save();

  // The user rides along so the controller does not query it a second time.
  return { ...next, user };
};

/**
 * Sign out: revoke the whole family the presented token belongs to, so the
 * still-valid access token dies with it. Idempotent and silent — an unknown
 * or already-revoked token is not an error the caller can do anything with.
 */
const revokeSession = async (refreshToken) => {
  if (typeof refreshToken !== 'string' || refreshToken.length === 0) return;

  const session = await Session.findOne({ tokenHash: hashToken(refreshToken) });
  if (!session) return;

  await Session.updateMany(
    { family: session.family, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
};

/**
 * Every session for a user, on every device. This is what a password change
 * (PF-124) calls so that older sessions die at once.
 */
const revokeAllForUser = async (userId) => {
  await Session.updateMany(
    { user: userId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
};

/** Does this family still have a live refresh token? `protect` asks. */
const isFamilyLive = async (family) =>
  Boolean(await Session.exists({ family, revokedAt: null }));

module.exports = {
  issueSession,
  rotateSession,
  revokeSession,
  revokeAllForUser,
  isFamilyLive,
  hashToken,
};
