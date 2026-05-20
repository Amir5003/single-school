const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const schoolScope = require('../middleware/schoolScope');

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

const router = express.Router();

// All teacher routes require authentication + school scope + teacher role
router.use(authenticate, schoolScope, authorize('teacher'));

// ── Classes ───────────────────────────────────────────────────────────────────
router.get('/classes', getAssignedClasses);
router.get('/classes/:classId/students', getClassStudents);

// ── Attendance ────────────────────────────────────────────────────────────────
router.post('/attendance', markAttendance);
router.get('/attendance', getAttendance);

// ── Marks ─────────────────────────────────────────────────────────────────────
router.post('/marks', saveMark);
router.get('/marks', getMarks);

// ── Announcements ─────────────────────────────────────────────────────────────
router.post('/announcements', createAnnouncement);
router.get('/announcements', getAnnouncements);
router.put('/announcements/:id', updateAnnouncement);
router.delete('/announcements/:id', deleteAnnouncement);
// ── Homework ─────────────────────────────────────────────────────────────────
router.post('/homework', uploadHomeworkAttachment, createHomeworkValidator, validate, homeworkController.createHomework);
router.get('/homework', homeworkController.listHomework);
router.delete('/homework/:id', homeworkController.deleteHomework);
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

