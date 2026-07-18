const User = require('../models/User.model');
const ApiError = require('../utils/ApiError');
const studentCountService = require('./subscription/studentCount.service');
const logger = require('../utils/logger');

/**
 * Return all users with approvalStatus 'pending', sorted newest first.
 * @returns {Promise<User[]>}
 */
const getPendingUsers = (schoolId) =>
  User.find({ approvalStatus: 'pending', schoolId })
    .select('-password')
    .sort({ createdAt: -1 });

const maybeRecountStudents = (user) => {
  if (!user) return;
  if (user.role !== 'student' || !user.schoolId) return;
  // Approving / rejecting a student flips its active state — refresh the
  // school's cached subscription counter (best-effort).
  studentCountService.updateCachedCount(user.schoolId).catch((err) => {
    logger.error(
      `[user.service] failed to refresh activeStudentCount for ${user.schoolId}: ${err.message}`
    );
  });
};

/**
 * Approve a pending (or rejected) user.
 * @param {string} id - User _id
 * @returns {Promise<User>}
 */
const approveUser = async (id, schoolId) => {
  const user = await User.findOneAndUpdate(
    { _id: id, schoolId },
    { approvalStatus: 'approved', isActive: true },
    { new: true, select: '-password' }
  );
  if (!user) throw new ApiError(404, 'User not found');
  maybeRecountStudents(user);
  return user;
};

/**
 * Reject a pending (or approved) user.
 * @param {string} id - User _id
 * @param {string} schoolId - Scoped to this school only
 * @returns {Promise<User>}
 */
const rejectUser = async (id, schoolId) => {
  const user = await User.findOneAndUpdate(
    { _id: id, schoolId },
    { approvalStatus: 'rejected', isActive: false },
    { new: true, select: '-password' }
  );
  if (!user) throw new ApiError(404, 'User not found');
  maybeRecountStudents(user);
  return user;
};

module.exports = { getPendingUsers, approveUser, rejectUser };
