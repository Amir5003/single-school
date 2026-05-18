const School = require('../models/School.model');
const ApiError = require('../utils/ApiError');

/**
 * schoolScope middleware
 *
 * Must run AFTER `authenticate`. Validates that:
 * 1. The JWT-embedded schoolId corresponds to an existing, active school.
 * 2. Sets req.school for downstream controllers/services.
 *
 * Super-admin requests bypass this middleware entirely — they are not
 * scoped to any school and must NOT have a schoolId in their token.
 *
 * @throws ApiError(403) when school is not found or isActive is false
 */
const schoolScope = async (req, res, next) => {
  try {
    // Super-admins operate at the platform level — no school scope needed
    if (req.user && req.user.role === 'super-admin') {
      return next();
    }

    const schoolId = req.user && req.user.schoolId;
    if (!schoolId) {
      return next(new ApiError(403, 'No school context — schoolId missing from token'));
    }

    const school = await School.findById(schoolId).lean();
    if (!school) {
      return next(new ApiError(403, 'School not found'));
    }
    if (!school.isActive) {
      return next(new ApiError(403, 'School account is inactive'));
    }

    req.school = school;
    return next();
  } catch (err) {
    return next(err);
  }
};

module.exports = schoolScope;
