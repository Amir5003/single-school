const express = require('express');
const authenticate = require('../middleware/authenticate');
const schoolScope = require('../middleware/schoolScope');
const authorize = require('../middleware/authorize');
const checkFeatureAccess = require('../middleware/checkFeatureAccess');
const { FEATURES } = require('../services/subscription/pricing.service');
const parentController = require('../controllers/parent.controller');

const router = express.Router();

// All parent routes: authenticate → schoolScope → authorize('parent')
router.use(authenticate, schoolScope, authorize('parent'));

// Exam/result surfaces are plan-gated exactly like the admin, teacher and
// student equivalents. Coursework is included: it is part of the same module.
const examsFeature = checkFeatureAccess(FEATURES.EXAMS_RESULTS);

router.get('/children', parentController.getChildren);
router.get('/children/:studentId/attendance', parentController.getChildAttendance);
router.get('/children/:studentId/coursework', examsFeature, parentController.getChildCoursework);
router.get('/children/:studentId/fees', parentController.getChildFees);
router.get('/children/:studentId/homework', parentController.getChildHomework);
router.get('/children/:studentId/notifications', parentController.getChildNotifications);

// ── Report cards — mirrors the student result routes one-for-one ─────────────
router.get('/children/:studentId/exam-years', examsFeature, parentController.getChildExamYears);
router.get('/children/:studentId/exams', examsFeature, parentController.getChildExams);
router.get('/children/:studentId/results', examsFeature, parentController.getChildResult);
router.get(
  '/children/:studentId/results/:examId/report-card',
  examsFeature,
  parentController.getChildReportCard
);

module.exports = router;
