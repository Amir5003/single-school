const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

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

const router = express.Router();

// All teacher routes require authentication + teacher role
router.use(authenticate, authorize('teacher'));

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

module.exports = router;

