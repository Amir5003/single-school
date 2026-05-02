const { body } = require('express-validator');

// Same regex as auth — 1 uppercase, 1 digit, 1 special char, min 8 chars
const PASSWORD_REGEX = /(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}/;

// Uppercase letters, digits, and hyphens (e.g. STU-001, TCH001)
const ENROLLMENT_REGEX = /^[A-Z0-9-]+$/;

/**
 * Validators for POST /admin/students (create).
 * All required fields must be present.
 */
const createStudentValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required'),

  body('email')
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),

  body('password')
    .matches(PASSWORD_REGEX)
    .withMessage(
      'Password must be at least 8 characters and include 1 uppercase letter, 1 digit, and 1 special character (!@#$%^&*)'
    ),

  body('enrollmentId')
    .trim()
    .notEmpty()
    .withMessage('Enrollment ID is required')
    .matches(ENROLLMENT_REGEX)
    .withMessage('Enrollment ID must contain only uppercase letters, digits, and hyphens'),

  body('dateOfBirth')
    .notEmpty()
    .withMessage('Date of birth is required')
    .isISO8601()
    .withMessage('Date of birth must be a valid ISO 8601 date (YYYY-MM-DD)')
    .toDate(),

  body('address')
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage('Address cannot exceed 300 characters'),

  body('phone')
    .optional()
    .trim()
    .isLength({ max: 15 })
    .withMessage('Phone cannot exceed 15 characters'),
];

/**
 * Validators for PUT /admin/students/:id (update — all fields optional).
 * Password is not updatable via this endpoint.
 */
const updateStudentValidator = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty'),

  body('phone')
    .optional()
    .trim()
    .isLength({ max: 15 })
    .withMessage('Phone cannot exceed 15 characters'),

  body('address')
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage('Address cannot exceed 300 characters'),

  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Date of birth must be a valid ISO 8601 date (YYYY-MM-DD)')
    .toDate(),

  body('enrollmentId')
    .optional()
    .trim()
    .matches(ENROLLMENT_REGEX)
    .withMessage('Enrollment ID must contain only uppercase letters, digits, and hyphens'),
];

module.exports = { createStudentValidator, updateStudentValidator };
