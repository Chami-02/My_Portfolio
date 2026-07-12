const router = require('express').Router();
const { login, getMe }  = require('../controllers/authController');
const { protect }       = require('../middleware/auth');
const { authLimiter }   = require('../middleware/rateLimiter');

// Public — rate limited (10 attempts per 15 minutes)
router.post('/login', authLimiter, login);

// Protected — requires valid JWT
router.get('/me', protect, getMe);

module.exports = router;