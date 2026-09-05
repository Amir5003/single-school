const User = require('../models/User.model');
const ApiError = require('../utils/ApiError');

/**
 * Record a school-admin's one-time acknowledgement that their school has a
 * lawful basis for the records it enters and has informed the people concerned
 * (or their guardians, where they are children).
 *
 * Idempotent by design: a repeat call returns the ORIGINAL timestamp rather
 * than overwriting it. The first acknowledgement is the evidentially
 * meaningful one; re-stamping it on every visit would destroy the only fact
 * worth recording.
 *
 * See specs/011-legal-terms-privacy (FR-011).
 *
 * @param {string} userId
 * @returns {Promise<{ adminDataAckAt: Date }>}
 */
const acknowledgeDataResponsibility = async (userId) => {
  const user = await User.findById(userId).select('adminDataAckAt');
  if (!user) throw new ApiError(404, 'User not found');

  if (!user.adminDataAckAt) {
    user.adminDataAckAt = new Date();
    await user.save({ validateBeforeSave: false });
  }

  return { adminDataAckAt: user.adminDataAckAt };
};

module.exports = { acknowledgeDataResponsibility };
