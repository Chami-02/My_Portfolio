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
 * starts a new one. The rest describes the sign-in and is copied forward by
 * every rotation:
 *   - `signedInAs` — the address the login used (PF-119 follow-up);
 *   - `signInMethod` — 'password' | 'google' (PF-131);
 *   - `device`, `location`, `startedAt` — the Sessions card (PF-132). A login
 *     leaves `startedAt` out and gets "now".
 */
const issueSession = async (user, {
  family = crypto.randomUUID(),
  signedInAs,
  signInMethod,
  device,
  location,
  startedAt = new Date(),
} = {}) => {
  const refreshToken     = crypto.randomBytes(32).toString('base64url');
  const refreshExpiresAt = new Date(Date.now() + refreshTtlMs());

  const session = await Session.create({
    user:      user._id,
    tokenHash: hashToken(refreshToken),
    family,
    expiresAt: refreshExpiresAt,
    signedInAs,
    signInMethod,
    device,
    location,
    startedAt,
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

  const next = await issueSession(user, {
    family:       session.family,
    signedInAs:   session.signedInAs,
    signInMethod: session.signInMethod,
    device:       session.device,
    location:     session.location,
    // A session from before PF-132 has no start; its first rotation since
    // then is the earliest moment known, and it is kept from there on.
    startedAt:    session.startedAt ?? session.createdAt,
  });
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
 * Every session for a user, on every device — so older sessions die at once
 * after a password reset (PF-125). `except` spares one family: the signed-in
 * change (PF-124) keeps the device that made it.
 */
const revokeAllForUser = async (userId, { except } = {}) => {
  await Session.updateMany(
    { user: userId, revokedAt: null, ...(except && { family: { $ne: except } }) },
    { $set: { revokedAt: new Date() } }
  );
};

/**
 * PF-132 — one entry per signed-in device: the LIVE row of each family. A
 * family has exactly one (rotation revokes the old row as it creates the
 * next), and that row was created at the last refresh — so its `createdAt`
 * is "last active", to within one access-token life (15 min).
 */
const listSessions = (userId) =>
  Session.find({ user: userId, revokedAt: null, expiresAt: { $gt: new Date() } })
    // `_id` breaks a tie: two sign-ins in one millisecond share a
    // `createdAt`, and an ObjectId made later in this process sorts later.
    .sort({ createdAt: -1, _id: -1 })
    .select('family signedInAs signInMethod device location startedAt createdAt')
    .lean();

/**
 * PF-132 — sign one device out. Scoped to `userId` in the QUERY, so a family
 * id that belongs to someone else matches nothing rather than being checked
 * after the fact. Returns whether a live session was ended.
 */
const revokeFamily = async (userId, family) => {
  const { modifiedCount } = await Session.updateMany(
    { user: userId, family, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
  return modifiedCount > 0;
};

/** Does this family still have a live refresh token? `protect` asks. */
const isFamilyLive = async (family) =>
  Boolean(await Session.exists({ family, revokedAt: null }));

module.exports = {
  issueSession,
  rotateSession,
  revokeSession,
  revokeAllForUser,
  listSessions,
  revokeFamily,
  isFamilyLive,
  hashToken,
};
