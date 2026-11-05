const crypto   = require('crypto');
const jwt      = require('jsonwebtoken');
const mongoose = require('mongoose');
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
 *   - an OPAQUE refresh token (32 random bytes) that the browser holds in an
 *     httpOnly cookie (PF-147, set by authController) and sends to
 *     `POST /api/auth/refresh` when the access token dies. Only its SHA-256
 *     is stored server-side.
 *
 * Rotation with reuse detection (RFC 9700 §4.14.2): every refresh revokes the
 * token presented and issues a successor in the same `family`. If a token
 * that has ALREADY been rotated is presented again, someone holds a copy that
 * the legitimate client no longer has — so the whole family is revoked and
 * both parties are signed out. PF-147 tolerates one innocent case, a repeat
 * inside REPEAT_WINDOW_MS — see `answerUsedToken`.
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

const SESSION_ENDED = 'Your session has ended. Please sign in again.';
const TRY_AGAIN     = "We couldn't renew your sign-in just now. Please try again.";

// PF-147 — how long a rotated token may be presented again without counting
// as theft. A reload or a dropped connection can lose the reply that carried
// its successor, and the browser then still holds the old token. The top of
// Okta's 0–60 s range, long enough for a person to press RETRY.
const REPEAT_WINDOW_MS = 60 * 1000;

/**
 * Create a fresh refresh-token row for `user` and sign an access token that
 * names its family. `family` and `id` are only passed by a rotation (the id
 * was already written to the row being replaced); a login starts a new family.
 * The rest describes the sign-in and is copied forward by every rotation:
 *   - `signedInAs` — the address the login used (PF-119 follow-up);
 *   - `signInMethod` — 'password' | 'google' (PF-131);
 *   - `device`, `location`, `startedAt` — the Sessions card (PF-132). A login
 *     leaves `startedAt` out and gets "now".
 */
const issueSession = async (user, {
  id,
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
    ...(id && { _id: id }),
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

const newRowId = () => new mongoose.Types.ObjectId();

const endFamily = (family, now) =>
  Session.updateMany({ family, revokedAt: null }, { $set: { revokedAt: now } });

// The row `replaced` already names `id` as its successor. Create that row.
const issueSuccessor = async (replaced, id) => {
  const user = await User.findById(replaced.user);
  if (!user) {
    throw new AppError(SESSION_ENDED, 401);
  }

  const next = await issueSession(user, {
    id,
    family:       replaced.family,
    signedInAs:   replaced.signedInAs,
    signInMethod: replaced.signInMethod,
    device:       replaced.device,
    location:     replaced.location,
    // A session from before PF-132 has no start; its first rotation since
    // then is the earliest moment known, and it is kept from there on.
    startedAt:    replaced.startedAt ?? replaced.createdAt,
  });

  // The user rides along so the controller does not query it a second time.
  return { ...next, user };
};

/**
 * PF-147 — a token that is already revoked was presented.
 *
 *   no `replacedBy`            signed out, not rotated: refused, never revived
 *   rotated over the window ago  theft: the family ends
 *   in the window, successor live  the reply was lost: replace the successor,
 *                                  so the family keeps exactly ONE live row
 *                                  (the Sessions card relies on that, PF-132)
 *   in the window, no successor yet  the first request is still working:
 *                                    503, nothing changes, the client retries
 *   in the window, successor revoked  signed out since, or rotated again by
 *                                     whoever holds it: the family ends
 */
const answerUsedToken = async (used, now) => {
  if (!used.replacedBy) {
    throw new AppError(SESSION_ENDED, 401);
  }

  const inWindow  = now - used.revokedAt <= REPEAT_WINDOW_MS;
  const successor = inWindow ? await Session.findById(used.replacedBy) : null;

  if (inWindow && !successor) {
    throw new AppError(TRY_AGAIN, 503);
  }

  if (!inWindow || successor.revokedAt) {
    await endFamily(used.family, now);
    // No token here: this line is how a later sign-out gets explained.
    console.warn('[session] A used refresh token was presented again; signed the session out.');
    throw new AppError(SESSION_ENDED, 401);
  }

  const id = newRowId();
  const claimed = await Session.findOneAndUpdate(
    { _id: successor._id, revokedAt: null },
    { $set: { revokedAt: now, replacedBy: id } },
    { returnDocument: 'after' }
  );
  if (!claimed) {
    throw new AppError(TRY_AGAIN, 503);
  }

  const next = await issueSuccessor(claimed, id);
  await Session.updateOne({ _id: used._id }, { $set: { replacedBy: id } });
  return next;
};

/**
 * Exchange a refresh token for a new access + refresh pair, revoking the one
 * presented. A 401 AppError means the session is over, and a more specific
 * message would only tell an attacker which part they got right. Anything
 * else (the 503 above, a database failure) is temporary, and the client keeps
 * its session.
 */
const rotateSession = async (refreshToken) => {
  if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
    throw new AppError(SESSION_ENDED, 401);
  }

  const now     = new Date();
  const session = await Session.findOne({ tokenHash: hashToken(refreshToken) });

  if (!session) {
    throw new AppError(SESSION_ENDED, 401);
  }

  if (session.revokedAt) {
    return answerUsedToken(session, now);
  }

  if (session.expiresAt <= now) {
    throw new AppError(SESSION_ENDED, 401);
  }

  // Atomic claim. Two requests racing with the same token both pass the reads
  // above; only one wins this update. `revokedAt` and `replacedBy` are written
  // TOGETHER, so a revoked row can always be told apart: rotated, or signed out.
  const id = newRowId();
  const claimed = await Session.findOneAndUpdate(
    { _id: session._id, revokedAt: null },
    { $set: { revokedAt: now, replacedBy: id } },
    { returnDocument: 'after' }
  );
  if (!claimed) {
    return answerUsedToken(await Session.findById(session._id), now);
  }

  return issueSuccessor(claimed, id);
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
 *
 * `$eq` keeps `family` a VALUE even if a caller passes an object: the route
 * already refuses non-strings, but the query must not rely on that
 * (`{ $ne: 'x' }` would match every session — CodeQL js/sql-injection).
 */
const revokeFamily = async (userId, family) => {
  const { modifiedCount } = await Session.updateMany(
    { user: userId, family: { $eq: family }, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
  return modifiedCount > 0;
};

/** Does this family still have a live refresh token? `protect` asks. */
const isFamilyLive = async (family) =>
  Boolean(await Session.exists({ family, revokedAt: null }));

/**
 * The address THIS login used. Same rule as `/auth/me`: a label is trusted
 * only while it is still one of the account's addresses, else the primary.
 * PF-124's change code goes ONLY here; PF-135's restore alert goes here and
 * to the primary. (Moved from passwordResetController in PF-135.)
 */
const signedInAddress = async (req) => {
  const session = await Session.findOne({ family: req.auth.family, revokedAt: null })
    .select('signedInAs');
  const used = session?.signedInAs;
  return [req.user.email, ...req.user.loginEmails].includes(used) ? used : req.user.email;
};

module.exports = {
  issueSession,
  rotateSession,
  revokeSession,
  revokeAllForUser,
  listSessions,
  revokeFamily,
  isFamilyLive,
  hashToken,
  signedInAddress,
};
