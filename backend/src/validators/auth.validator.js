const { body } = require('express-validator');

const ROLES = ['school-admin', 'teacher', 'student', 'parent'];

// Password must have: 1 uppercase, 1 digit, 1 special char, min 8 chars
const PASSWORD_REGEX = /(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}/;

const registerValidator = [
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

  body('role')
    .isIn(ROLES)
    .withMessage(`Role must be one of: ${ROLES.join(', ')}`),

  // schoolId is required for teacher/student/parent — not for school-admin (onboarding sets it)
  body('schoolId')
    .if(body('role').isIn(['teacher', 'student', 'parent']))
    .notEmpty()
    .withMessage('schoolId is required for this role')
    .isMongoId()
    .withMessage('schoolId must be a valid MongoDB ObjectId'),
];

const loginValidator = [
  body('email')
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

module.exports = { registerValidator, loginValidator };
