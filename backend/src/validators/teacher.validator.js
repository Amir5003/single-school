const { body } = require('express-validator');

// Same regex as auth — 1 uppercase, 1 digit, 1 special char, min 8 chars
const PASSWORD_REGEX = /(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}/;
// Uppercase letters, digits, and hyphens (e.g. TCH-001)
const EMPLOYEE_ID_REGEX = /^[A-Z0-9-]+$/;

/**
 * Validators for POST /admin/teachers (create).
 */
const createTeacherValidator = [
  body('name').trim().notEmpty().withMessage('Name is required'),

  body('email')
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),

  body('password')
    .matches(PASSWORD_REGEX)
    .withMessage(
      'Password must be at least 8 characters and include 1 uppercase letter, 1 digit, and 1 special character (!@#$%^&*)'
    ),

  body('employeeId')
    .trim()
    .notEmpty()
    .withMessage('Employee ID is required')
    .matches(EMPLOYEE_ID_REGEX)
    .withMessage('Employee ID must contain only uppercase letters, digits, and hyphens'),

  body('phone')
    .optional()
    .trim()
    .isLength({ max: 15 })
    .withMessage('Phone cannot exceed 15 characters'),
];

/**
 * Validators for PUT /admin/teachers/:id (update — all fields optional).
 * Password is not updatable via this endpoint.
 */
const updateTeacherValidator = [
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

  body('employeeId')
    .optional()
    .trim()
    .matches(EMPLOYEE_ID_REGEX)
    .withMessage('Employee ID must contain only uppercase letters, digits, and hyphens'),
];

/**
 * Validators for POST /admin/teachers/:id/assign-class
 */
const assignClassValidator = [
  body('classId').isMongoId().withMessage('Valid class ID is required'),
  body('subject').trim().notEmpty().withMessage('Subject is required'),
];

module.exports = { createTeacherValidator, updateTeacherValidator, assignClassValidator };
