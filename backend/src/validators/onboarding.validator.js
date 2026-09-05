const { body, query } = require('express-validator');

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;

const validateRegister = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('School name must be between 2 and 200 characters'),

  body('slug')
    .trim()
    .toLowerCase()
    .matches(SLUG_REGEX)
    .withMessage(
      'Slug must be 3-50 characters, lowercase alphanumeric and hyphens only, cannot start or end with a hyphen'
    ),

  body('adminEmail')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('A valid admin email is required'),

  body('adminPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one digit'),

  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 30 })
    .withMessage('Phone number must not exceed 30 characters'),

  // Strict: only a real boolean `true` counts. `.isBoolean()` would accept
  // "true", 1 and "on", which is exactly the sort of accidental acceptance
  // this gate exists to prevent.
  body('acceptedTerms')
    .custom((value) => value === true)
    .withMessage(
      'You must accept the Terms of Service and Privacy Notice to register a school'
    ),
];

const validateSlugCheck = [
  query('slug')
    .trim()
    .toLowerCase()
    .matches(SLUG_REGEX)
    .withMessage('Invalid slug format'),
];

module.exports = { validateRegister, validateSlugCheck };
