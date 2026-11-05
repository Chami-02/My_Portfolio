const router = require('express').Router();
const {
  loginRules, login, refresh, logout, getMe,
  googleStart, googleCallback, googleExchange,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const fromOurSite = require('../middleware/fromOurSite');
const validate    = require('../middleware/validate');
const {
  forgotRules, forgotPassword, resetRules, resetPassword,
  changeCodeRules, requestChangeCode, changeRules, changePassword,
} = require('../controllers/passwordResetController');
const {
  getSessions, getSignIns, revokeRules, revokeSessionById, revokeOthersRules, revokeOtherSessions,
} = require('../controllers/sessionController');
const passkey = require('../controllers/passkeyController');
const {
  authLimiter, refreshLimiter, googleLimiter, forgotLimiter, resetLimiter, changeLimiter,
  sessionsLimiter, passkeyLimiter, passkeyChangeLimiter,
} = require('../middleware/rateLimiter');

// Public — rate limited (10 attempts per 15 minutes)
// The limiter FIRST, so a malformed body still spends an attempt; then the
// shape check (non-empty strings), then the handler.
router.post('/login', authLimiter, loginRules, validate, login);

// Public, its own limiter (PF-108). Neither refresh nor logout sits behind
// `protect`: the access token is expected to be dead when refresh is called,
// and a client whose session has ended must still be able to sign out
// cleanly rather than be told it is not logged in. They are the only two routes
// that act on the cookie, so they are the two that need `fromOurSite` (PF-147).
router.post('/refresh', refreshLimiter, fromOurSite, refresh);
router.post('/logout', fromOurSite, logout);

// Google sign-in (PF-119). `start` and `callback` are top-level browser
// navigations that answer with redirects; `exchange` is the SPA's JSON call
// that trades the one-time handoff for a session. One limiter for all three.
router.get('/google/start',     googleLimiter, googleStart);
router.get('/google/callback',  googleLimiter, googleCallback);
router.post('/google/exchange', googleLimiter, googleExchange);

// Passkey sign-in (PF-140). Public and cookie-bound, so `fromOurSite` too. The
// limiter first, as on /login.
router.post('/passkey/login/options', passkeyLimiter, fromOurSite, passkey.loginOptions);
router.post('/passkey/login/verify',  passkeyLimiter, fromOurSite, passkey.loginRules, validate, passkey.loginVerify);

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

// Passkeys in Settings (PF-140). Adding and removing need the password; `protect`
// first, as on the change routes.
router.get('/passkeys', protect, passkey.listPasskeys);
router.post('/passkey/register/options', protect, passkeyChangeLimiter, passkey.registerOptionsRules, validate, passkey.registerOptions);
router.post('/passkey/register/verify',  protect, passkeyChangeLimiter, passkey.registerVerifyRules,  validate, passkey.registerVerify);
router.post('/passkeys/remove',          protect, passkeyChangeLimiter, passkey.removeRules,          validate, passkey.removePasskey);

module.exports = router;
