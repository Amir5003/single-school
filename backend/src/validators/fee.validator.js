const { body } = require('express-validator');
const mongoose = require('mongoose');

const createFeeValidator = [
  body('studentId')
    .notEmpty()
    .withMessage('studentId is required')
    .custom((v) => mongoose.Types.ObjectId.isValid(v))
    .withMessage('studentId must be a valid ObjectId'),

  body('amount')
    .notEmpty()
    .withMessage('amount is required')
    .isFloat({ gt: 0 })
    .withMessage('amount must be a positive number'),

  body('description')
    .trim()
    .notEmpty()
    .withMessage('description is required')
    .isLength({ max: 300 })
    .withMessage('description must be at most 300 characters'),

  body('dueDate')
    .notEmpty()
    .withMessage('dueDate is required')
    .isISO8601()
    .withMessage('dueDate must be a valid ISO 8601 date'),
];

module.exports = { createFeeValidator };
