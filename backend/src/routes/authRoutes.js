const router = require('express').Router();
const {
  loginRules, login, refresh, logout, getMe,
  googleStart, googleCallback, googleExchange,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const validate    = require('../middleware/validate');
const {
  forgotRules, forgotPassword, resetRules, resetPassword,
  changeCodeRules, requestChangeCode, changeRules, changePassword,
} = require('../controllers/passwordResetController');
const {
  getSessions, getSignIns, revokeRules, revokeSessionById, revokeOthersRules, revokeOtherSessions,
} = require('../controllers/sessionController');
const {
  authLimiter, refreshLimiter, googleLimiter, forgotLimiter, resetLimiter, changeLimiter,
  sessionsLimiter,
} = require('../middleware/rateLimiter');

// Public — rate limited (10 attempts per 15 minutes)
// The limiter FIRST, so a malformed body still spends an attempt; then the
// shape check (non-empty strings), then the handler.
router.post('/login', authLimiter, loginRules, validate, login);

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

// Forgot password (PF-125). Public, each with its own limiter — limiter
// first, as on /login, so a malformed body still spends an attempt.
router.post('/password/forgot', forgotLimiter, forgotRules, validate, forgotPassword);
router.post('/password/reset',  resetLimiter,  resetRules,  validate, resetPassword);

// Protected — requires a live session
router.get('/me', protect, getMe);

// Change password in Settings (PF-124). `protect` first — the limiter then
// counts only signed-in attempts, never a stranger's 401s.
router.post('/password/change/code', protect, changeLimiter, changeCodeRules, validate, requestChangeCode);
router.post('/password/change',      protect, changeLimiter, changeRules,     validate, changePassword);

// Signed-in devices in Settings (PF-132). Signing one out needs the current
// password (OWASP ASVS 5.0 V7.5.2); `protect` first, as on the change routes.
router.get('/sessions', protect, getSessions);
// Sign-in history in the same card (PF-133).
router.get('/sign-ins', protect, getSignIns);
router.post('/sessions/revoke',        protect, sessionsLimiter, revokeRules,       validate, revokeSessionById);
router.post('/sessions/revoke-others', protect, sessionsLimiter, revokeOthersRules, validate, revokeOtherSessions);

module.exports = router;
