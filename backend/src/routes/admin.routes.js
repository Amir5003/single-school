const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const schoolScope = require('../middleware/schoolScope');
const validate = require('../middleware/validate');
const checkSubscriptionAccess = require('../middleware/checkSubscriptionAccess');
const checkFeatureAccess = require('../middleware/checkFeatureAccess');
const { FEATURES } = require('../services/subscription/pricing.service');

// Shorthand: subscription gate factory for admin mutating routes.
const adminWrite = checkSubscriptionAccess('admin_write');
const studentOnboarding = checkSubscriptionAccess('student_onboarding');
const examsFeature = checkFeatureAccess(FEATURES.EXAMS_RESULTS);

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

const { acknowledge: acknowledgeLegal } = require('../controllers/admin/legal.controller');
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
const feeConfigController = require('../controllers/feeConfig.controller');
const notificationController = require('../controllers/notification.controller');
const { validateBrandingUpdate } = require('../validators/school.validator');
const { uploadLogo: uploadLogoMiddleware } = require('../middleware/uploadMiddleware');
const brandingController = require('../controllers/admin/branding.controller');
const { createExamValidator, updateExamValidator } = require('../validators/exam.validator');
const { upsertResultsValidator } = require('../validators/result.validator');
const { reassignValidator } = require('../validators/subjectSubmission.validator');
const examController = require('../controllers/admin/exam.controller');
const resultController = require('../controllers/admin/result.controller');
const examLifecycleController = require('../controllers/admin/examLifecycle.controller');

const router = express.Router();

// All admin routes require authentication + school scope + school-admin role
router.use(authenticate, schoolScope, authorize('school-admin'));

// ── Student CRUD ──────────────────────────────────────────────────────────────
// POST gated by `student_onboarding` to enforce the trial student-limit.
// PUT/DELETE gated by `admin_write` — modifying existing students is allowed
// while in trial_limit_reached but blocked when expired/cancelled.
// ── Legal ────────────────────────────────────────────────────────────────────
// Deliberately NOT gated by checkSubscriptionAccess: an admin whose trial has
// lapsed must still be able to record this acknowledgement.
router.post('/legal/ack', acknowledgeLegal);

router.get('/students', listStudents);
router.post('/students', studentOnboarding, createStudentValidator, validate, createStudent);
router.get('/students/:id', getStudent);
router.put('/students/:id', adminWrite, updateStudentValidator, validate, updateStudent);
router.delete('/students/:id', adminWrite, deleteStudent);

// ── Teacher CRUD ──────────────────────────────────────────────────────────────
router.get('/teachers', listTeachers);
router.post('/teachers', adminWrite, createTeacherValidator, validate, createTeacher);
router.get('/teachers/:id', getTeacher);
router.put('/teachers/:id', adminWrite, updateTeacherValidator, validate, updateTeacher);
router.delete('/teachers/:id', adminWrite, deleteTeacher);
router.post('/teachers/:id/assign-class', adminWrite, assignClassValidator, validate, assignToClass);

// ── Class CRUD ────────────────────────────────────────────────────────────────
router.get('/classes', listClasses);
router.post('/classes', adminWrite, createClassValidator, validate, createClass);
router.get('/classes/:id', getClass);
router.put('/classes/:id', adminWrite, updateClassValidator, validate, updateClass);
router.delete('/classes/:id', adminWrite, deleteClass);
router.post('/classes/:id/assign-teacher', adminWrite, assignTeacherValidator, validate, assignTeacher);
router.post('/classes/:id/assign-students', adminWrite, assignStudentsValidator, validate, assignStudents);

// ── Timetable ─────────────────────────────────────────────────────────────────
router.get('/timetable', listByClass);
router.post('/timetable', adminWrite, createTimetableValidator, validate, createEntry);
router.put('/timetable/:id', adminWrite, updateTimetableValidator, validate, updateEntry);
router.delete('/timetable/:id', adminWrite, deleteEntry);

// ── Announcements (admin manages all) ────────────────────────────────────────
router.get('/announcements', listAnnouncements);
router.put('/announcements/:id', adminWrite, adminUpdateAnnouncement);
router.delete('/announcements/:id', adminWrite, adminDeleteAnnouncement);
// ── User approval ─────────────────────────────────────────────────────────────
router.get('/users/pending', listPendingUsers);
router.put('/users/:id/approve', adminWrite, approveUser);
router.put('/users/:id/reject', adminWrite, rejectUser);

// ── Fees ─────────────────────────────────────────────────────────────────────
router.post('/fees', adminWrite, createFeeValidator, validate, feeController.createFee);
router.get('/fees', feeConfigController.listFeesDetailed);          // enhanced list with details
router.patch('/fees/:id/pay', adminWrite, feeController.markPaid);              // legacy compat
router.patch('/fees/:id/status', adminWrite, feeConfigController.updateFeeStatus);

// ── Fee Configs (class-level templates) ──────────────────────────────────────
router.get('/fee-configs',         feeConfigController.listFeeConfigs);
router.post('/fee-configs',        adminWrite, feeConfigController.createFeeConfig);
router.patch('/fee-configs/:id',   adminWrite, feeConfigController.updateFeeConfig);
router.delete('/fee-configs/:id',  adminWrite, feeConfigController.deleteFeeConfig);
router.post('/fee-configs/:id/generate', adminWrite, feeConfigController.generateFees);

// ── School Branding ───────────────────────────────────────────────────────────
router.patch('/school/branding', adminWrite, validateBrandingUpdate, validate, brandingController.updateBranding);
router.post('/school/logo', adminWrite, uploadLogoMiddleware, brandingController.uploadLogo);

// ── Notifications ───────────────────────────────────────────────────────────
router.post('/notifications', adminWrite, notificationController.sendNotification);
router.get('/notifications', notificationController.listNotifications);
router.patch('/notifications/:id/read', notificationController.markRead);

// ── Exams & Results (gated by EXAMS_RESULTS feature — not in Starter) ────────
router.get('/exams', examsFeature, examController.listExams);
router.post('/exams', examsFeature, adminWrite, createExamValidator, validate, examController.createExam);
router.get('/exams/:examId', examsFeature, examController.getExam);
router.put('/exams/:examId', examsFeature, adminWrite, updateExamValidator, validate, examController.updateExam);
router.delete('/exams/:examId', examsFeature, adminWrite, examController.deleteExam);
router.get('/exams/:examId/results', examsFeature, resultController.getResultsForExam);
router.put('/exams/:examId/results', examsFeature, adminWrite, upsertResultsValidator, validate, resultController.upsertResults);

// ── Exam Lifecycle (state machine + dashboard) ───────────────────────────────
router.post('/exams/:examId/activate', examsFeature, adminWrite, examLifecycleController.activate);
router.post('/exams/:examId/publish', examsFeature, adminWrite, examLifecycleController.publish);
router.post('/exams/:examId/revert-to-draft', examsFeature, adminWrite, examLifecycleController.revertToDraft);
router.get('/exams/:examId/dashboard', examsFeature, examLifecycleController.dashboard);
router.post(
  '/exams/:examId/submissions/:submissionId/reopen',
  examsFeature,
  adminWrite,
  examLifecycleController.reopenSubmission
);
router.post(
  '/exams/:examId/submissions/:submissionId/reassign',
  examsFeature,
  adminWrite,
  reassignValidator,
  validate,
  examLifecycleController.reassignSubmission
);

module.exports = router;
