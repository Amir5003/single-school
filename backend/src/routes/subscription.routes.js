const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const schoolScope = require('../middleware/schoolScope');
const validate = require('../middleware/validate');
const checkSubscriptionAccess = require('../middleware/checkSubscriptionAccess');

const {
  upgradeValidator,
  verifyPaymentValidator,
  scheduleDowngradeValidator,
} = require('../validators/subscription.validator');

const subscriptionController = require('../controllers/subscription.controller');

const router = express.Router();

// All subscription routes: authenticate → schoolScope → school-admin only.
router.use(authenticate, schoolScope, authorize('school-admin'));

const billing = checkSubscriptionAccess('billing');

router.get('/', billing, subscriptionController.getSubscription);
router.get('/pricing', billing, subscriptionController.getPricing);
router.get('/history', billing, subscriptionController.getHistory);

router.post(
  '/upgrade',
  billing,
  upgradeValidator,
  validate,
  subscriptionController.createUpgradeOrder
);
router.post(
  '/verify-payment',
  billing,
  verifyPaymentValidator,
  validate,
  subscriptionController.verifyPayment
);
router.post(
  '/schedule-downgrade',
  billing,
  scheduleDowngradeValidator,
  validate,
  subscriptionController.scheduleDowngrade
);
router.delete('/scheduled-change', billing, subscriptionController.cancelScheduledChange);
router.post('/cancel', billing, subscriptionController.cancelSubscription);

module.exports = router;
