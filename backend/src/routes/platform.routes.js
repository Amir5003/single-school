const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const platformController = require('../controllers/platform.controller');

const router = express.Router();

// All platform routes: authenticate → authorize('super-admin') — NO schoolScope
router.use(authenticate, authorize('super-admin'));

router.get('/schools', platformController.listSchools);
router.get('/schools/:id', platformController.getSchool);
router.patch('/schools/:id/activate', platformController.activateSchool);
router.patch('/schools/:id/deactivate', platformController.deactivateSchool);
router.get('/analytics', platformController.getAnalytics);

// Pending school-admin registration approvals
router.get('/pending-registrations', platformController.listPendingRegistrations);
router.patch('/registrations/:userId/approve', platformController.approveRegistration);
router.patch('/registrations/:userId/reject', platformController.rejectRegistration);

module.exports = router;
