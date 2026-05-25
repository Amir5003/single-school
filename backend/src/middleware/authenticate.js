const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');

/**
 * Reads the JWT from the `Authorization: Bearer <token>` header (preferred)
 * or the legacy httpOnly `token` cookie, then attaches
 * `req.user = { _id, role, schoolId }` for downstream middleware/controllers.
 */
const authenticate = (req, _res, next) => {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  const bearerToken =
    authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const token = bearerToken || req.cookies?.token;

  if (!token) {
    return next(new ApiError(401, 'Authentication required'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { _id: decoded.id, role: decoded.role, schoolId: decoded.schoolId || null };
    return next();
  } catch (err) {
    // Covers both TokenExpiredError and JsonWebTokenError
    return next(new ApiError(401, 'Invalid or expired token'));
  }
};

module.exports = authenticate;
