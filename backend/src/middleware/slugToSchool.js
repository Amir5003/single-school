const { getSchoolBySlug } = require('../services/slugCache.service');
const ApiError = require('../utils/ApiError');

/**
 * slugToSchool middleware
 *
 * Resolves the `:slug` URL param to a School document via the LRU slug cache.
 * Sets req.school and req.schoolId for downstream handlers.
 *
 * Used on public routes (school landing, public config) where there is no JWT.
 *
 * @throws ApiError(404) when the slug does not resolve to an existing school
 */
const slugToSchool = async (req, res, next) => {
  try {
    const slug = req.params.slug;
    if (!slug) {
      return next(new ApiError(400, 'School slug is required'));
    }

    const school = await getSchoolBySlug(slug);
    if (!school) {
      return next(new ApiError(404, 'School not found'));
    }

    req.school = school;
    req.schoolId = school._id;
    return next();
  } catch (err) {
    return next(err);
  }
};

module.exports = slugToSchool;
