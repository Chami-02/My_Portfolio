const jwt  = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');

// ── Helper: create a signed JWT ───────────────────────────────────────────────
// Called after successful login. Signs the user's MongoDB _id into the token.
const signToken = (userId) =>
  jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

// ── POST /api/auth/login ──────────────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Check both fields were provided
    if (!email || !password) {
      return next(new AppError('Please provide email and password', 400));
    }

    // 2. Find user — we need password field which is select: false on the schema
    const user = await User.findOne({ email }).select('+password');

    // 3. Check user exists AND password matches
    // We check both in one condition to prevent user enumeration attacks
    // (never tell the attacker which one was wrong)
    if (!user || !(await user.matchPassword(password))) {
      return next(new AppError('Invalid email or password', 401));
    }

    // 4. Create token and send it
    const token = signToken(user._id);

    res.json({
      status: 'success',
      token,
      data: {
        id:    user._id,
        email: user.email,
        role:  user.role,
      },
    });
  } catch (err) {
    next(err);
  }
};
// ── GET /api/auth/me ──────────────────────────────────────────────────────────
// Returns the currently logged-in user (from the JWT, set on req.user by protect middleware)
const getMe = (req, res) => {
  res.json({
    status: 'success',
    data: {
      id:    req.user._id,
      email: req.user.email,
      role:  req.user.role,
    },
  });
};

module.exports = { login, getMe };