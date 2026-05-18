const { body } = require('express-validator');

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

const validateBrandingUpdate = [
  body('primaryColor')
    .optional()
    .matches(HEX_COLOR_REGEX)
    .withMessage('primaryColor must be a valid 6-digit hex color (e.g. #1a73e8)'),

  body('secondaryColor')
    .optional()
    .matches(HEX_COLOR_REGEX)
    .withMessage('secondaryColor must be a valid 6-digit hex color (e.g. #fbbc04)'),

  body('tagline')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Tagline must be at most 200 characters'),

  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address must be at most 500 characters'),

  body('contactNumber')
    .optional()
    .trim(),
];

const validatePlanUpdate = [
  body('plan')
    .isIn(['free', 'standard', 'premium'])
    .withMessage('Plan must be one of: free, standard, premium'),
];

module.exports = { validateBrandingUpdate, validatePlanUpdate };
