const User = require('../models/User.model');
const ApiError = require('../utils/ApiError');

/**
 * Return all users with approvalStatus 'pending', sorted newest first.
 * @returns {Promise<User[]>}
 */
const getPendingUsers = (schoolId) =>
  User.find({ approvalStatus: 'pending', schoolId })
    .select('-password')
    .sort({ createdAt: -1 });

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
  return user;
};

module.exports = { getPendingUsers, approveUser, rejectUser };
