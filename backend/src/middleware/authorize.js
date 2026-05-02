const ApiError = require('../utils/ApiError');

/**
 * Role-based access control middleware factory.
 * Must be used AFTER `authenticate` (requires `req.user` to be set).
 *
 * @param {...string} roles - Allowed roles (e.g. 'admin', 'teacher')
 * @returns {Function} Express middleware
 *
 * @example
 * router.get('/admin-only', authenticate, authorize('admin'), handler);
 */
const authorize = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new ApiError(403, 'You do not have permission to access this resource'));
  }
  return next();
};

module.exports = authorize;
