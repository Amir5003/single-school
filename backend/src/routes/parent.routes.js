const express = require('express');
const authenticate = require('../middleware/authenticate');
const schoolScope = require('../middleware/schoolScope');
const authorize = require('../middleware/authorize');
const parentController = require('../controllers/parent.controller');

const router = express.Router();

// All parent routes: authenticate → schoolScope → authorize('parent')
router.use(authenticate, schoolScope, authorize('parent'));

router.get('/children', parentController.getChildren);
router.get('/children/:studentId/attendance', parentController.getChildAttendance);
router.get('/children/:studentId/marks', parentController.getChildMarks);
router.get('/children/:studentId/fees', parentController.getChildFees);
router.get('/children/:studentId/homework', parentController.getChildHomework);
router.get('/children/:studentId/notifications', parentController.getChildNotifications);

module.exports = router;
