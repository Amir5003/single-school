const { body } = require('express-validator');
const { isValidPlan, isValidCycle } = require('../services/subscription/pricing.service');

const upgradeValidator = [
  body('planType')
    .notEmpty()
    .withMessage('planType is required')
    .bail()
    .custom((v) => isValidPlan(v))
    .withMessage('planType must be one of: starter, standard, premium'),
  body('billingCycle')
    .optional()
    .custom((v) => isValidCycle(v))
    .withMessage('billingCycle must be either monthly or annual'),
];

const verifyPaymentValidator = [
  body('orderId').notEmpty().withMessage('orderId is required'),
  body('providerPaymentId').notEmpty().withMessage('providerPaymentId is required'),
  body('providerSignature').notEmpty().withMessage('providerSignature is required'),
  body('planType')
    .optional()
    .custom((v) => isValidPlan(v))
    .withMessage('planType must be one of: starter, standard, premium'),
  body('billingCycle')
    .optional()
    .custom((v) => isValidCycle(v))
    .withMessage('billingCycle must be either monthly or annual'),
];

const scheduleDowngradeValidator = [
  body('planType')
    .notEmpty()
    .withMessage('planType is required')
    .bail()
    .custom((v) => isValidPlan(v))
    .withMessage('planType must be one of: starter, standard, premium'),
  body('billingCycle')
    .optional()
    .custom((v) => isValidCycle(v))
    .withMessage('billingCycle must be either monthly or annual'),
];

module.exports = { upgradeValidator, verifyPaymentValidator, scheduleDowngradeValidator };
