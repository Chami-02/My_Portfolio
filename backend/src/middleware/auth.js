const jwt      = require('jsonwebtoken');
const User     = require('../models/User');
const AppError = require('../utils/AppError');
const { isFamilyLive } = require('../services/sessionService');

/**
 * Protect middleware — attach to any route that requires authentication.
 *
 * Expects: "Authorization: Bearer <access token>" header.
 * On success: attaches req.user = the User document, and
 *             req.auth = { iat, exp, family } from the verified token.
 * On failure: calls next() with a 401 AppError.
 *
 * PF-108: an access token is only honoured while its session FAMILY is
 * still live — see sessionService. That is what makes logout, reuse
 * detection and a password change (PF-124) take effect immediately rather
 * than after the token's own expiry. A token signed without a family (the
 * pre-PF-108 shape) is refused outright, so a 7-day token issued before this
 * change cannot outlive it.
 */
const protect = async (req, _res, next) => {
  try {
    // 1. Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(
        new AppError('You are not logged in. Please log in to access this.', 401)
      );
    }

    const token = authHeader.split(' ')[1];

    // 2. Verify the token's signature and expiry
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // jwt.verify throws JsonWebTokenError or TokenExpiredError if invalid/expired

    // 3. The session family behind the token must still be live
    if (!decoded.fam || !(await isFamilyLive(decoded.fam))) {
      return next(new AppError('Your session has ended. Please log in again.', 401));
    }

    // 4. Check that the user still exists (they may have been deleted)
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return next(
        new AppError('The user belonging to this token no longer exists.', 401)
      );
    }

    // 5. Attach user and token facts to the request
    req.user = currentUser;
    req.auth = { iat: decoded.iat, exp: decoded.exp, family: decoded.fam };
    next();

  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token. Please log in again.', 401));
    }
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Your session has expired. Please log in again.', 401));
    }
    next(err);
  }
};

module.exports = { protect };
