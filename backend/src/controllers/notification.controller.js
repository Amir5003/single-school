const notificationService = require('../services/notification.service');
const ApiResponse = require('../utils/ApiResponse');

const sendNotification = async (req, res, next) => {
  try {
    const schoolId = req.school._id;
    const senderId = req.user._id;
    const notification = await notificationService.createNotification(schoolId, senderId, req.body);
    res.status(201).json(new ApiResponse(201, { notification }, 'Notification sent successfully'));
  } catch (err) {
    next(err);
  }
};

const listNotifications = async (req, res, next) => {
  try {
    const schoolId = req.school._id;
    const recipientRole = req.user.role;
    const { page, limit } = req.query;
    const result = await notificationService.listForRecipient(schoolId, recipientRole, { page, limit });
    res.json(new ApiResponse(200, result, 'Notifications retrieved successfully'));
  } catch (err) {
    next(err);
  }
};

const markRead = async (req, res, next) => {
  try {
    const schoolId = req.school._id;
    const userId = req.user._id;
    const notification = await notificationService.markRead(schoolId, req.params.id, userId);
    res.json(new ApiResponse(200, { notification }, 'Notification marked as read'));
  } catch (err) {
    next(err);
  }
};

module.exports = { sendNotification, listNotifications, markRead };
