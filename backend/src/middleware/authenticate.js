const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');

/**
 * Reads the httpOnly `token` cookie, verifies the JWT, and attaches
 * `req.user = { _id, role }` for downstream middleware/controllers.
 */
const authenticate = (req, _res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return next(new ApiError(401, 'Authentication required'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { _id: decoded.id, role: decoded.role };
    return next();
  } catch (err) {
    // Covers both TokenExpiredError and JsonWebTokenError
    return next(new ApiError(401, 'Invalid or expired token'));
  }
};

module.exports = authenticate;
