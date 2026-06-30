/**
 * Global error handling middleware.
 *
 * Express identifies this as error-handling middleware because
 * it takes FOUR arguments (err, req, res, next).
 * Must be the LAST app.use() call in app.js.
 */
const errorHandler = (err, req, res, _next) => {
  // Default to 500 Internal Server Error if no statusCode was set
  err.statusCode = err.statusCode || 500;
  err.status     = err.status     || 'error';

  // ── DEVELOPMENT: send full details to help you debug ──────────────
  if (process.env.NODE_ENV === 'development') {
    return res.status(err.statusCode).json({
      status:  err.status,
      message: err.message,
      stack:   err.stack,          // Full stack trace
      error:   err,               // The entire error object
    });
  }

  // ── PRODUCTION: never expose internals ────────────────────────────
  if (err.isOperational) {
    // Our own AppError — safe to send the message to the client
    return res.status(err.statusCode).json({
      status:  err.status,
      message: err.message,
    });
  }

  // A bug — something we didn't expect (null reference, syntax error, etc.)
  // Log it on the server but don't expose details to the client
  console.error('UNEXPECTED ERROR 💥', err);
  return res.status(500).json({
    status:  'error',
    message: 'Something went wrong. Please try again later.',
  });
};

module.exports = errorHandler;