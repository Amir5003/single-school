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

const router = express.Router();

// All student routes require authentication + school scope + student role
router.use(authenticate, schoolScope, authorize('student'));

router.get('/profile',       getProfile);
router.get('/timetable',     getTimetable);
router.get('/attendance',    getAttendance);
router.get('/marks',         getMarks);
router.get('/announcements', getAnnouncements);
router.get('/fees', feeController.getMyFees);
router.get('/homework', homeworkController.getStudentHomework);
router.get('/notifications', notificationController.listNotifications);
router.patch('/notifications/:id/read', notificationController.markRead);

module.exports = router;
