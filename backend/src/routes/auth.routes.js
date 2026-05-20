const express = require('express');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const { registerValidator, loginValidator } = require('../validators/auth.validator');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const schoolScope = require('../middleware/schoolScope');
const authorize = require('../middleware/authorize');
const authController = require('../controllers/auth.controller');
const passwordResetController = require('../controllers/passwordReset.controller');

const router = express.Router();

// Rate limiter for forgot-password (5 req per 15 min per IP)
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

// POST /api/v1/auth/register
router.post('/register', registerValidator, validate, authController.register);

// POST /api/v1/auth/login
router.post('/login', loginValidator, validate, authController.login);

// POST /api/v1/auth/refresh  — issues new access token from refresh cookie
router.post('/refresh', authController.refresh);

// POST /api/v1/auth/logout   — clears both cookies + nullifies refreshTokenHash
router.post('/logout', authenticate, authController.logout);

// GET /api/v1/auth/me  (protected)
router.get('/me', authenticate, authController.getMe);

// ── Password reset flow ───────────────────────────────────────────────────────
// POST /api/v1/auth/forgot-password  (public — rate limited)
router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  [body('email').isEmail().withMessage('Valid email is required').normalizeEmail()],
  validate,
  passwordResetController.forgotPassword
);

// POST /api/v1/auth/reset-password  (public)
router.post(
  '/reset-password',
  [
    body('token').trim().notEmpty().withMessage('Reset token is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters'),
  ],
  validate,
  passwordResetController.resetPassword
);

// PUT /api/v1/auth/change-password  (authenticated students and teachers)
router.put(
  '/change-password',
  authenticate,
  schoolScope,
  authorize('student', 'teacher'),
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters'),
  ],
  validate,
  passwordResetController.changePassword
);

module.exports = router;
