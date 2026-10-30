const { body } = require('express-validator');
const User     = require('../models/User');

// PF-132, shared since PF-135: "type your password again" before a sensitive
// action — signing a device out, downloading the backup.
//
// Standard: OWASP ASVS 5.0 V7.5 — authenticate AGAIN before a sensitive
// action, so a borrowed or stolen open laptop cannot do it.
//
// A wrong password is answered 400, never 401 (the PF-124 rule): the client
// treats any 401 as "this session has ended" and signs out — a mistyped
// password must not.

const WRONG_PASSWORD = 'Your password is wrong.';

const passwordRule = body('password')
  .isString().withMessage('Password must be text').bail()
  .notEmpty().withMessage('Password is required');

/** True when `req.body.password` is the signed-in user's current password. */
const checkPassword = async (req) => {
  const account = await User.findById(req.user._id).select('+password');
  return account.matchPassword(req.body.password);
};

module.exports = { WRONG_PASSWORD, passwordRule, checkPassword };
