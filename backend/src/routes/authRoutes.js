const router = require('express').Router();
const { login, refresh, logout, getMe } = require('../controllers/authController');
const { protect }                       = require('../middleware/auth');
const { authLimiter, refreshLimiter }   = require('../middleware/rateLimiter');

// Public — rate limited (10 attempts per 15 minutes)
router.post('/login', authLimiter, login);

// Public, its own limiter (PF-108). Neither refresh nor logout sits behind
// `protect`: the access token is expected to be dead when refresh is called,
// and a client whose session has ended must still be able to sign out
// cleanly rather than be told it is not logged in.
router.post('/refresh', refreshLimiter, refresh);
router.post('/logout', logout);

// Protected — requires a live session
router.get('/me', protect, getMe);

module.exports = router;
