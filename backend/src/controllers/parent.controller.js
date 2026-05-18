const parentService = require('../services/parent.service');
const ApiResponse = require('../utils/ApiResponse');

/**
 * GET /api/v1/parent/children
 */
const getChildren = async (req, res, next) => {
  try {
    const children = await parentService.getChildren(
      req.user._id,
      req.school._id
    );
    return res.status(200).json(new ApiResponse(200, { children }, 'Children retrieved'));
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/v1/parent/children/:studentId/attendance
 */
const getChildAttendance = async (req, res, next) => {
  try {
    const attendance = await parentService.getChildAttendance(
      req.user._id,
      req.params.studentId,
      req.school._id
    );
    return res.status(200).json(new ApiResponse(200, { attendance }, 'Attendance retrieved'));
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/v1/parent/children/:studentId/marks
 */
const getChildMarks = async (req, res, next) => {
  try {
    const marks = await parentService.getChildMarks(
      req.user._id,
      req.params.studentId,
      req.school._id
    );
    return res.status(200).json(new ApiResponse(200, { marks }, 'Marks retrieved'));
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/v1/parent/children/:studentId/fees
 */
const getChildFees = async (req, res, next) => {
  try {
    const fees = await parentService.getChildFees(
      req.user._id,
      req.params.studentId,
      req.school._id
    );
    return res.status(200).json(new ApiResponse(200, { fees }, 'Fees retrieved'));
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/v1/parent/children/:studentId/homework
 */
const getChildHomework = async (req, res, next) => {
  try {
    const homework = await parentService.getChildHomework(
      req.user._id,
      req.params.studentId,
      req.school._id
    );
    return res.status(200).json(new ApiResponse(200, { homework }, 'Homework retrieved'));
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/v1/parent/children/:studentId/notifications
 */
const getChildNotifications = async (req, res, next) => {
  try {
    const notifications = await parentService.getChildNotifications(
      req.user._id,
      req.params.studentId,
      req.school._id
    );
    return res
      .status(200)
      .json(new ApiResponse(200, { notifications }, 'Notifications retrieved'));
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getChildren,
  getChildAttendance,
  getChildMarks,
  getChildFees,
  getChildHomework,
  getChildNotifications,
};
