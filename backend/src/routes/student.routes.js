const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const {
  getProfile,
  getTimetable,
  getAttendance,
  getMarks,
  getAnnouncements,
} = require('../controllers/student/student.controller');

const router = express.Router();

// All student routes require authentication + student role
router.use(authenticate, authorize('student'));

router.get('/profile',       getProfile);
router.get('/timetable',     getTimetable);
router.get('/attendance',    getAttendance);
router.get('/marks',         getMarks);
router.get('/announcements', getAnnouncements);

module.exports = router;
