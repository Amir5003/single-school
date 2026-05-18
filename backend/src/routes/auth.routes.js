const express = require('express');
const { registerValidator, loginValidator } = require('../validators/auth.validator');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const authController = require('../controllers/auth.controller');

const router = express.Router();

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

module.exports = router;
