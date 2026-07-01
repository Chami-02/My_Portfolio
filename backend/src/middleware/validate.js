const { validationResult } = require('express-validator');
const AppError             = require('../utils/AppError');

/**
 * Place this middleware AFTER your express-validator rule arrays in routes.
 *
 * Usage in a route file:
 *   router.post('/', [body('name').notEmpty()], validate, controller);
 *
 * If validation fails, it stops the request and sends a 400 error.
 * If validation passes, it calls next() to reach the controller.
 */
const validate = (req, _res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    // Join all validation messages into one readable string
    const message = errors
      .array()
      .map((e) => e.msg)
      .join(', ');

    return next(new AppError(message, 400));
  }

  next();
};

module.exports = validate;