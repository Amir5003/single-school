const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const schoolScope = require('../middleware/schoolScope');
const validate = require('../middleware/validate');

const {
  createStudentValidator,
  updateStudentValidator,
} = require('../validators/student.validator');
const {
  createTeacherValidator,
  updateTeacherValidator,
  assignClassValidator,
} = require('../validators/teacher.validator');
const {
  createClassValidator,
  updateClassValidator,
  assignTeacherValidator,
  assignStudentsValidator,
} = require('../validators/class.validator');
const {
  createTimetableValidator,
  updateTimetableValidator,
} = require('../validators/timetable.validator');

const {
  createStudent,
  listStudents,
  getStudent,
  updateStudent,
  deleteStudent,
} = require('../controllers/admin/student.controller');
const {
  createTeacher,
  listTeachers,
  getTeacher,
  updateTeacher,
  deleteTeacher,
  assignToClass,
} = require('../controllers/admin/teacher.controller');
const {
  createClass,
  listClasses,
  getClass,
  updateClass,
  deleteClass,
  assignStudents,
  assignTeacher,
} = require('../controllers/admin/class.controller');
const {
  createEntry,
  listByClass,
  updateEntry,
  deleteEntry,
} = require('../controllers/admin/timetable.controller');
const {
  listAnnouncements,
  updateAnnouncement: adminUpdateAnnouncement,
  deleteAnnouncement: adminDeleteAnnouncement,
} = require('../controllers/admin/announcement.controller');
const {
  listPendingUsers,
  approveUser,
  rejectUser,
} = require('../controllers/admin/user.controller');

const { createFeeValidator } = require('../validators/fee.validator');
const feeController = require('../controllers/fee.controller');
const notificationController = require('../controllers/notification.controller');
const { validateBrandingUpdate } = require('../validators/school.validator');
const { uploadLogo: uploadLogoMiddleware } = require('../middleware/uploadMiddleware');
const brandingController = require('../controllers/admin/branding.controller');

const router = express.Router();

// All admin routes require authentication + school scope + school-admin role
router.use(authenticate, schoolScope, authorize('school-admin'));

// ── Student CRUD ──────────────────────────────────────────────────────────────
router.get('/students', listStudents);
router.post('/students', createStudentValidator, validate, createStudent);
router.get('/students/:id', getStudent);
router.put('/students/:id', updateStudentValidator, validate, updateStudent);
router.delete('/students/:id', deleteStudent);

// ── Teacher CRUD ──────────────────────────────────────────────────────────────
router.get('/teachers', listTeachers);
router.post('/teachers', createTeacherValidator, validate, createTeacher);
router.get('/teachers/:id', getTeacher);
router.put('/teachers/:id', updateTeacherValidator, validate, updateTeacher);
router.delete('/teachers/:id', deleteTeacher);
router.post('/teachers/:id/assign-class', assignClassValidator, validate, assignToClass);

// ── Class CRUD ────────────────────────────────────────────────────────────────
router.get('/classes', listClasses);
router.post('/classes', createClassValidator, validate, createClass);
router.get('/classes/:id', getClass);
router.put('/classes/:id', updateClassValidator, validate, updateClass);
router.delete('/classes/:id', deleteClass);
router.post('/classes/:id/assign-teacher', assignTeacherValidator, validate, assignTeacher);
router.post('/classes/:id/assign-students', assignStudentsValidator, validate, assignStudents);

// ── Timetable ─────────────────────────────────────────────────────────────────
router.get('/timetable', listByClass);
router.post('/timetable', createTimetableValidator, validate, createEntry);
router.put('/timetable/:id', updateTimetableValidator, validate, updateEntry);
router.delete('/timetable/:id', deleteEntry);

// ── Announcements (admin manages all) ────────────────────────────────────────
router.get('/announcements', listAnnouncements);
router.put('/announcements/:id', adminUpdateAnnouncement);
router.delete('/announcements/:id', adminDeleteAnnouncement);
// ── User approval ─────────────────────────────────────────────────────────────
router.get('/users/pending', listPendingUsers);
router.put('/users/:id/approve', approveUser);
router.put('/users/:id/reject', rejectUser);

// ── Fees ─────────────────────────────────────────────────────────────────────
router.post('/fees', createFeeValidator, validate, feeController.createFee);
router.get('/fees', feeController.listFees);
router.patch('/fees/:id/pay', feeController.markPaid);

// ── School Branding ───────────────────────────────────────────────────────────
router.patch('/school/branding', validateBrandingUpdate, validate, brandingController.updateBranding);
router.post('/school/logo', uploadLogoMiddleware, brandingController.uploadLogo);

// ── Notifications ───────────────────────────────────────────────────────────
router.post('/notifications', notificationController.sendNotification);
router.get('/notifications', notificationController.listNotifications);
router.patch('/notifications/:id/read', notificationController.markRead);

module.exports = router;
