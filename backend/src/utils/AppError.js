// A custom Error subclass that lets us attach an HTTP status code
// to any error we throw. The global error handler (PF-17) reads
// this statusCode to set the correct HTTP response status.

class AppError extends Error {
  /**
   * @param {string} message  - Human-readable error description
   * @param {number} statusCode - HTTP status code (400, 401, 404, 500, etc.)
   */
  constructor(message, statusCode) {
    super(message);                 // Pass message to native Error class
    this.statusCode = statusCode;
    // 4xx = 'fail' (client mistake), 5xx = 'error' (server problem)
    this.status     = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    // isOperational = true means WE intentionally threw this error.
    // Unexpected bugs (null references, etc.) will NOT have isOperational = true.
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;