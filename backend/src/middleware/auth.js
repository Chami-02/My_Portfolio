const jwt      = require('jsonwebtoken');
const User     = require('../models/User');
const AppError = require('../utils/AppError');

/**
 * Protect middleware — attach to any route that requires authentication.
 *
 * Expects: "Authorization: Bearer <token>" header.
 * On success: attaches req.user = the User document.
 * On failure: calls next() with a 401 AppError.
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

    // 3. Check that the user still exists (they may have been deleted)
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return next(
        new AppError('The user belonging to this token no longer exists.', 401)
      );
    }

    // 4. Attach user to request — controllers can now use req.user
    req.user = currentUser;
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