const onboardingService = require('../services/onboarding.service');
const authService = require('../services/auth.service');
const ApiResponse = require('../utils/ApiResponse');

const IS_PROD = process.env.NODE_ENV === 'production';

const ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: IS_PROD ? 'none' : 'strict',
  secure: IS_PROD,
  maxAge: 15 * 60 * 1000,
};

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: IS_PROD ? 'none' : 'strict',
  secure: IS_PROD,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

/**
 * GET /api/v1/onboarding/slug-check?slug=...
 * Returns availability and suggestions.
 */
const checkSlug = async (req, res, next) => {
  try {
    const { slug } = req.query;
    const result = await onboardingService.checkSlugAvailability(slug);
    return res.status(200).json(new ApiResponse(200, result, 'Slug availability checked'));
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/v1/onboarding/register
 * Registers a new school + admin user; auto-issues JWT cookies.
 */
const registerSchool = async (req, res, next) => {
  try {
    const { name, slug, adminEmail, adminPassword } = req.body;
    const { school, admin } = await onboardingService.registerSchool({
      name,
      slug,
      adminEmail,
      adminPassword,
    });

    // Auto-login the new admin
    const accessToken = authService.signAccessToken(admin);
    const refreshToken = authService.signRefreshToken(admin);

    return res
      .status(201)
      .cookie('token', accessToken, ACCESS_COOKIE_OPTIONS)
      .cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS)
      .json(
        new ApiResponse(
          201,
          {
            school: {
              _id: school._id,
              name: school.name,
              slug: school.slug,
              branding: school.branding,
              plan: school.plan,
            },
            user: admin,
          },
          'School registered successfully'
        )
      );
  } catch (err) {
    return next(err);
  }
};

module.exports = { checkSlug, registerSchool };
