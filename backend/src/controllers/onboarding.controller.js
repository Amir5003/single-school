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
 * Best-effort source IP for the acceptance record.
 *
 * `trust proxy` is deliberately NOT enabled app-wide — it changes how
 * express-rate-limit identifies clients, which is not a change to make as a
 * side effect of this feature. The first X-Forwarded-For hop is read directly
 * instead, falling back to the socket address. Evidential weight only: this
 * value is never used for authorization.
 */
const clientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || null;
};

/**
 * POST /api/v1/onboarding/register
 * Registers a new school + admin user; auto-issues JWT cookies.
 *
 * `acceptedTerms` is required by the validator. Note that no version string is
 * read from the body — the accepted version is stamped server-side in
 * onboarding.service.js so a client cannot claim to have accepted a version
 * that was never published.
 */
const registerSchool = async (req, res, next) => {
  try {
    // `phone` is validated by onboarding.validator and accepted by the
    // service, but was previously not forwarded — the admin's phone number was
    // silently dropped on every registration.
    const { name, slug, adminEmail, adminPassword, phone } = req.body;
    const { school, admin } = await onboardingService.registerSchool({
      name,
      slug,
      adminEmail,
      adminPassword,
      phone,
      acceptedIp: clientIp(req),
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
