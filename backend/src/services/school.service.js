const School = require('../models/School.model');
const { getSchoolBySlug, invalidate } = require('./slugCache.service');
const ApiError = require('../utils/ApiError');

/**
 * Return public branding fields for a school resolved by slug.
 * Uses the LRU slug cache — avoids a DB round-trip on repeated requests.
 */
const getSchoolConfigBySlug = async (slug) => {
  const school = await getSchoolBySlug(slug.toLowerCase());
  if (!school) throw new ApiError(404, 'School not found');
  return {
    name: school.name,
    slug: school.slug,
    branding: school.branding || {},
    // A school stays inactive until a super-admin approves it. The landing
    // page needs this to avoid offering a login that can only ever 403.
    isActive: Boolean(school.isActive),
  };
};

/**
 * Update branding sub-fields for a school.
 * Only updates the keys provided in brandingData; other branding
 * fields are left untouched.  Invalidates the slug cache afterwards.
 */
const updateBranding = async (schoolId, brandingData) => {
  const update = {};
  for (const [key, val] of Object.entries(brandingData)) {
    update[`branding.${key}`] = val;
  }

  const school = await School.findByIdAndUpdate(
    schoolId,
    { $set: update },
    { new: true, lean: true }
  );
  if (!school) throw new ApiError(404, 'School not found');

  invalidate(school.slug);
  return school;
};

/**
 * Persist a Cloudinary-uploaded logo URL to the school's branding.
 * `file.path` is the secure Cloudinary URL set by multer-storage-cloudinary.
 * `file.filename` is the Cloudinary public_id (used for future deletion).
 */
const uploadLogo = async (schoolId, file) => {
  const school = await School.findByIdAndUpdate(
    schoolId,
    {
      $set: {
        'branding.logoUrl': file.path,
        'branding.logoPublicId': file.filename,
      },
    },
    { new: true, lean: true }
  );
  if (!school) throw new ApiError(404, 'School not found');

  invalidate(school.slug);
  return school;
};

module.exports = { getSchoolConfigBySlug, updateBranding, uploadLogo };
