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
 * GET /api/v1/parent/children/:studentId/coursework
 */
const getChildCoursework = async (req, res, next) => {
  try {
    const data = await parentService.getChildCoursework(
      req.user._id,
      req.params.studentId,
      req.school._id
    );
    return res.status(200).json(new ApiResponse(200, data, 'Coursework retrieved'));
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

/**
 * GET /api/v1/parent/children/:studentId/exam-years
 */
const getChildExamYears = async (req, res, next) => {
  try {
    const years = await parentService.getChildExamYears(
      req.user._id,
      req.params.studentId,
      req.school._id
    );
    return res.status(200).json(new ApiResponse(200, { years }, 'Exam years retrieved'));
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/v1/parent/children/:studentId/exams
 */
const getChildExams = async (req, res, next) => {
  try {
    const exams = await parentService.getChildExams(
      req.user._id,
      req.params.studentId,
      req.school._id,
      req.query.year
    );
    return res.status(200).json(new ApiResponse(200, { exams }, 'Exams retrieved'));
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/v1/parent/children/:studentId/results
 */
const getChildResult = async (req, res, next) => {
  try {
    const result = await parentService.getChildResult(
      req.user._id,
      req.params.studentId,
      req.school._id,
      req.query.examId
    );
    return res.status(200).json(new ApiResponse(200, result, 'Result retrieved'));
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/v1/parent/children/:studentId/results/:examId/report-card
 */
const getChildReportCard = async (req, res, next) => {
  try {
    const payload = await parentService.getChildReportCard(
      req.user._id,
      req.params.studentId,
      req.school._id,
      req.params.examId
    );
    return res.status(200).json(new ApiResponse(200, payload, 'Report card retrieved'));
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getChildren,
  getChildAttendance,
  getChildCoursework,
  getChildFees,
  getChildHomework,
  getChildNotifications,
  getChildExamYears,
  getChildExams,
  getChildResult,
  getChildReportCard,
};
