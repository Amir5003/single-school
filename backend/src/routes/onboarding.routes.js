const express = require('express');
const { checkSlug, registerSchool } = require('../controllers/onboarding.controller');
const { validateRegister, validateSlugCheck } = require('../validators/onboarding.validator');
const validate = require('../middleware/validate');

const router = express.Router();

// GET  /api/v1/onboarding/slug-check?slug=...
router.get('/slug-check', validateSlugCheck, validate, checkSlug);

// POST /api/v1/onboarding/register
router.post('/register', validateRegister, validate, registerSchool);

module.exports = router;
