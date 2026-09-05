const mongoose = require('mongoose');
const School = require('../models/School.model');
const User = require('../models/User.model');
const ApiError = require('../utils/ApiError');
const emailConflictError = require('../utils/emailConflict');
const subscriptionLifecycle = require('./subscription/lifecycle.service');
const { TERMS_VERSION, PRIVACY_VERSION } = require('../constants/legalVersions');

/**
 * Check if a slug is available and suggest alternatives if taken.
 *
 * @param {string} slug
 * @returns {Promise<{ available: boolean, suggestions: string[] }>}
 */
const checkSlugAvailability = async (slug) => {
  const existing = await School.findOne({ slug });
  if (!existing) {
    return { available: true, suggestions: [] };
  }

  // Generate suggestion variants
  const suggestions = [];
  for (let i = 1; i <= 3; i++) {
    const candidate = `${slug}-${i}`;
    const taken = await School.exists({ slug: candidate });
    if (!taken) suggestions.push(candidate);
    if (suggestions.length >= 3) break;
  }

  return { available: false, suggestions };
};

/**
 * Register a new school and its admin user atomically.
 * Uses a MongoDB session for transactional safety.
 *
 * The acceptance of the Terms is recorded on the School inside the SAME
 * transaction. A school that exists without an acceptance record is the one
 * state this whole feature exists to prevent, so the write must never be
 * moved outside the transaction for convenience.
 *
 * @param {{ name, slug, adminEmail, adminPassword, phone, acceptedIp }} params
 * @returns {Promise<{ school: School, admin: User }>}
 */
const registerSchool = async ({ name, slug, adminEmail, adminPassword, phone, acceptedIp }) => {
  // Check slug uniqueness before starting session
  const slugTaken = await School.exists({ slug });
  if (slugTaken) {
    throw new ApiError(409, 'This slug is already taken');
  }

  // A new school is being created, so any existing account is necessarily
  // attached to a different one.
  const emailTaken = await User.exists({ email: adminEmail });
  if (emailTaken) {
    throw emailConflictError(null, { publicCaller: true });
  }

  const session = await mongoose.startSession();
  let school, admin;

  try {
    // The admin's _id is pre-generated so the School — created first — can
    // record who accepted the Terms without a second write inside the
    // transaction.
    const adminId = new mongoose.Types.ObjectId();
    const acceptedAt = new Date();

    await session.withTransaction(async () => {
      [school] = await School.create(
        [{
          name,
          slug,
          isActive: false,
          slugLockedAt: new Date(),
          legal: {
            // Stamped from the server constant. Anything the client sent under
            // this name is ignored — see constants/legalVersions.js.
            termsVersion: TERMS_VERSION,
            privacyVersion: PRIVACY_VERSION,
            termsAcceptedAt: acceptedAt,
            termsAcceptedBy: adminId,
            termsAcceptedIp: acceptedIp || null,
          },
        }],
        { session }
      );

      [admin] = await User.create(
        [
          {
            _id: adminId,
            name: `${name} Admin`,
            email: adminEmail,
            password: adminPassword,
            role: 'school-admin',
            schoolId: school._id,
            isActive: false,
            approvalStatus: 'pending',
            phone: phone || null,
          },
        ],
        { session }
      );

      // Bootstrap the 30-day free trial. The School.subscription subdoc
      // already has sane defaults from the schema, but we call the
      // lifecycle initializer so the trial_started event is logged
      // atomically with school creation.
      await subscriptionLifecycle.initializeForNewSchool(school._id, { session });
    });
  } finally {
    await session.endSession();
  }

  return { school, admin };
};

module.exports = { checkSlugAvailability, registerSchool };
