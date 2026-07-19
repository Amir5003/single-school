const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const schoolScope = require('../middleware/schoolScope');
const checkSubscriptionAccess = require('../middleware/checkSubscriptionAccess');
const checkFeatureAccess = require('../middleware/checkFeatureAccess');
const { FEATURES } = require('../services/subscription/pricing.service');

const teacherWrite = checkSubscriptionAccess('teacher_write');
const examsFeature = checkFeatureAccess(FEATURES.EXAMS_RESULTS);

const {
  getAssignedClasses,
  getClassStudents,
  markAttendance,
  getAttendance,
} = require('../controllers/teacher/attendance.controller');
const { saveMark, getMarks } = require('../controllers/teacher/marks.controller');
const {
  createAnnouncement,
  getAnnouncements,
  updateAnnouncement,
  deleteAnnouncement,
} = require('../controllers/teacher/announcement.controller');
const homeworkController = require('../controllers/homework.controller');
const { uploadHomeworkAttachment } = require('../middleware/uploadMiddleware');
const { createHomeworkValidator } = require('../validators/homework.validator');
const validate = require('../middleware/validate');
const notificationController = require('../controllers/notification.controller');
const subjectSubmissionController = require('../controllers/teacher/subjectSubmission.controller');
const { saveDraftValidator } = require('../validators/subjectSubmission.validator');

const router = express.Router();

// All teacher routes require authentication + school scope + teacher role
router.use(authenticate, schoolScope, authorize('teacher'));

// ── Classes ───────────────────────────────────────────────────────────────────
router.get('/classes', getAssignedClasses);
router.get('/classes/:classId/students', getClassStudents);

// ── Attendance ────────────────────────────────────────────────────────────────
router.post('/attendance', teacherWrite, markAttendance);
router.get('/attendance', getAttendance);

// ── Marks — part of the exam/result module, gated like the exam routes ───────
router.post('/marks', teacherWrite, examsFeature, saveMark);
router.get('/marks', examsFeature, getMarks);

// ── Exam subject submissions (005 flow) — gated by EXAMS_RESULTS feature ─────
router.get('/exams', examsFeature, subjectSubmissionController.listMyExams);
router.get('/exams/:examId/submissions', examsFeature, subjectSubmissionController.getMySubmissions);
router.get('/submissions/:id', examsFeature, subjectSubmissionController.getOne);
router.put(
  '/submissions/:id/marks',
  examsFeature,
  teacherWrite,
  saveDraftValidator,
  validate,
  subjectSubmissionController.saveDraft
);
router.post('/submissions/:id/submit', examsFeature, teacherWrite, subjectSubmissionController.submit);

// ── Announcements ─────────────────────────────────────────────────────────────
router.post('/announcements', teacherWrite, createAnnouncement);
router.get('/announcements', getAnnouncements);
router.put('/announcements/:id', teacherWrite, updateAnnouncement);
router.delete('/announcements/:id', teacherWrite, deleteAnnouncement);
// ── Homework ─────────────────────────────────────────────────────────────────
router.post('/homework', teacherWrite, uploadHomeworkAttachment, createHomeworkValidator, validate, homeworkController.createHomework);
router.get('/homework', homeworkController.listHomework);
router.delete('/homework/:id', teacherWrite, homeworkController.deleteHomework);
// ── Notifications ─────────────────────────────────────────────────────────────
router.get('/notifications', notificationController.listNotifications);
router.patch('/notifications/:id/read', notificationController.markRead);

// ── Password ──────────────────────────────────────────────────────────────────
const passwordResetService = require('../services/passwordReset.service');
const { body } = require('express-validator');
const ApiResponse = require('../utils/ApiResponse');

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

