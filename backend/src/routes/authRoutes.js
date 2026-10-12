const router = require('express').Router();
const {
  login, refresh, logout, getMe,
  googleStart, googleCallback, googleExchange,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authLimiter, refreshLimiter, googleLimiter } = require('../middleware/rateLimiter');

// Public — rate limited (10 attempts per 15 minutes)
router.post('/login', authLimiter, login);

// Public, its own limiter (PF-108). Neither refresh nor logout sits behind
// `protect`: the access token is expected to be dead when refresh is called,
// and a client whose session has ended must still be able to sign out
// cleanly rather than be told it is not logged in.
router.post('/refresh', refreshLimiter, refresh);
router.post('/logout', logout);

// Google sign-in (PF-119). `start` and `callback` are top-level browser
// navigations that answer with redirects; `exchange` is the SPA's JSON call
// that trades the one-time handoff for a session. One limiter for all three.
router.get('/google/start',     googleLimiter, googleStart);
router.get('/google/callback',  googleLimiter, googleCallback);
router.post('/google/exchange', googleLimiter, googleExchange);

// Protected — requires a live session
router.get('/me', protect, getMe);

module.exports = router;
