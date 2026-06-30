const rateLimit = require('express-rate-limit');

/**
 * Applied to ALL routes in app.js.
 * Allows 100 requests per IP per 15-minute window.
 */
const globalLimiter = rateLimit({
  windowMs:       15 * 60 * 1000,  // 15 minutes in milliseconds
  max:            100,              // Max requests per IP per window
  standardHeaders: true,           // Send RateLimit-* headers to client
  legacyHeaders:  false,
  message: {
    status:  'fail',
    message: 'Too many requests from this IP. Please try again in 15 minutes.',
  },
});

/**
 * Stricter limiter for the login endpoint.
 * Allows only 10 login attempts per IP per 15 minutes.
 * Used in authRoutes.js (Sprint 6, PF-34).
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      10,
  message: {
    status:  'fail',
    message: 'Too many login attempts. Please wait 15 minutes before trying again.',
  },
});

module.exports = { globalLimiter, authLimiter };