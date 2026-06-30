const AppError = require('../utils/AppError');

/**
 * Catches all unmatched routes.
 * Must be placed AFTER all route definitions in app.js.
 * Must be placed BEFORE the errorHandler in app.js.
 */
const notFound = (req, _res, next) => {
  next(
    new AppError(
      `Route not found: ${req.method} ${req.originalUrl}`,
      404
    )
  );
};

module.exports = notFound;