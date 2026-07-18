const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const schoolScope = require('../middleware/schoolScope');
const {
  getProfile,
  getTimetable,
  getAttendance,
  getMarks,
  getAnnouncements,
} = require('../controllers/student/student.controller');
const feeController = require('../controllers/fee.controller');
const homeworkController = require('../controllers/homework.controller');
const notificationController = require('../controllers/notification.controller');
const examService = require('../services/exam.service');
const resultService = require('../services/result.service');
const ApiResponse = require('../utils/ApiResponse');

const ApiError = require('../utils/ApiError');
const passwordResetService = require('../services/passwordReset.service');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const checkFeatureAccess = require('../middleware/checkFeatureAccess');
const { FEATURES } = require('../services/subscription/pricing.service');

const router = express.Router();

// All student routes require authentication + school scope + student role
router.use(authenticate, schoolScope, authorize('student'));

const examsFeature = checkFeatureAccess(FEATURES.EXAMS_RESULTS);

router.get('/profile',       getProfile);
router.get('/timetable',     getTimetable);
router.get('/attendance',    getAttendance);
router.get('/marks',         getMarks);
router.get('/announcements', getAnnouncements);
router.get('/fees', feeController.getMyFees);
router.get('/homework', homeworkController.getStudentHomework);
router.get('/notifications', notificationController.listNotifications);
router.patch('/notifications/:id/read', notificationController.markRead);

// ── Exams & Results — gated by EXAMS_RESULTS feature (not in Starter) ────────
router.get('/exams/years', examsFeature, async (req, res, next) => {
  try {
    const years = await examService.getDistinctYears(req.school._id);
    res.json(new ApiResponse(200, { years }, 'Years retrieved'));
  } catch (err) {
    next(err);
  }
});

router.get('/exams', examsFeature, async (req, res, next) => {
  try {
    const Student = require('../models/Student.model');
    const student = await Student.findOne({ userId: req.user._id, schoolId: req.school._id }).lean();
    if (!student) return next(new ApiError(404, 'Student profile not found'));
    const exams = await examService.getExamsForStudent(req.school._id, student._id, req.query.year);
    res.json(new ApiResponse(200, { exams }, 'Exams retrieved'));
  } catch (err) {
    next(err);
  }
});

router.get('/results', examsFeature, async (req, res, next) => {
  try {
    const Student = require('../models/Student.model');
    const student = await Student.findOne({ userId: req.user._id, schoolId: req.school._id }).lean();
    if (!student) return next(new ApiError(404, 'Student profile not found'));
    const result = await resultService.getStudentResult(req.school._id, student._id, req.query.examId);
    res.json(new ApiResponse(200, result, 'Result retrieved'));
  } catch (err) {
    next(err);
  }
});

// Report-card payload for client-side PDF generation
router.get('/results/:examId/report-card', examsFeature, async (req, res, next) => {
  try {
    const Student = require('../models/Student.model');
    const student = await Student.findOne({ userId: req.user._id, schoolId: req.school._id }).lean();
    if (!student) return next(new ApiError(404, 'Student profile not found'));
    const payload = await examService.buildReportCardPayload(
      req.school._id,
      student._id,
      req.params.examId
    );
    res.json(new ApiResponse(200, payload, 'Report card payload retrieved'));
  } catch (err) {
    next(err);
  }
});

// ── Password ──────────────────────────────────────────────────────────────────
router.put(
  '/password',
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;
      await passwordResetService.changePassword(req.user._id, currentPassword, newPassword);
      res.json(new ApiResponse(200, null, 'Password changed successfully'));
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
