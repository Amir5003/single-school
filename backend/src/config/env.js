const REQUIRED_VARS = ['PORT', 'MONGO_URI', 'JWT_SECRET', 'JWT_EXPIRES_IN', 'REFRESH_TOKEN_SECRET'];

// Cloudinary is required in production only
const PRODUCTION_REQUIRED_VARS = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];

REQUIRED_VARS.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});

if (process.env.NODE_ENV === 'production') {
  PRODUCTION_REQUIRED_VARS.forEach((key) => {
    if (!process.env[key]) {
      throw new Error(`Missing required production environment variable: ${key}`);
    }
  });
}

/**
 * Optional global pricing promo — a fraction in [0, 0.9] applied on top of each
 * plan's sale price (e.g. 0.10 = an extra 10% off). Empty/undefined = no promo.
 * Kept here so all pricing config lives in one validated place.
 */
const parsePricingPromoPct = () => {
  const raw = process.env.PRICING_PROMO_PCT;
  if (raw == null || raw === '') return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 0.9) {
    throw new Error(
      'PRICING_PROMO_PCT must be a number between 0 and 0.9 (e.g. 0.10 for 10% off)'
    );
  }
  return n;
};

module.exports = {
  PORT: process.env.PORT,
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  // Refresh token — separate secret, 7-day TTL
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
  REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  // Cloudinary — image/file storage (logos, homework attachments)
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  // Migration / seed helpers
  SEED_SCHOOL_ID: process.env.SEED_SCHOOL_ID,
  SUPER_ADMIN_EMAIL: process.env.SUPER_ADMIN_EMAIL,
  SUPER_ADMIN_PASSWORD: process.env.SUPER_ADMIN_PASSWORD,
  // Pricing — optional global promo fraction, validated to [0, 0.9]
  PRICING_PROMO_PCT: parsePricingPromoPct(),
};
