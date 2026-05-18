const Notification = require('../models/Notification.model');

const PAGE_SIZE = 20;

/**
 * Create and broadcast an in-platform notification to a role group.
 *
 * @param {string} schoolId
 * @param {string} senderId   — User._id of the sender
 * @param {{ targetRole, title, body }} data
 */
const createNotification = async (schoolId, senderId, { targetRole, title, body }) => {
  return Notification.create({ schoolId, senderId, targetRole, title, body });
};

/**
 * List notifications visible to a specific recipient role.
 * Returns notifications where targetRole === recipientRole OR targetRole === 'all'.
 */
const listForRecipient = async (schoolId, recipientRole, { page = 1, limit = PAGE_SIZE } = {}) => {
  const filter = {
    schoolId,
    targetRole: { $in: [recipientRole, 'all'] },
  };
  const skip = (page - 1) * limit;
  const [notifications, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    Notification.countDocuments(filter),
  ]);
  return { notifications, total, page: Number(page), pages: Math.ceil(total / limit) };
};

/**
 * Mark a notification as read by a user (idempotent — uses $addToSet).
 *
 * @param {string} schoolId
 * @param {string} notificationId
 * @param {string} userId
 */
const markRead = async (schoolId, notificationId, userId) => {
  return Notification.findOneAndUpdate(
    { _id: notificationId, schoolId },
    { $addToSet: { readBy: userId } },
    { new: true }
  );
};

module.exports = { createNotification, listForRecipient, markRead };
