const { body } = require('express-validator');
const mongoose = require('mongoose');

const createHomeworkValidator = [
  body('classId')
    .notEmpty()
    .withMessage('classId is required')
    .custom((v) => mongoose.Types.ObjectId.isValid(v))
    .withMessage('classId must be a valid ObjectId'),

  body('title')
    .trim()
    .notEmpty()
    .withMessage('title is required')
    .isLength({ max: 200 })
    .withMessage('title must be at most 200 characters'),

  body('dueDate')
    .notEmpty()
    .withMessage('dueDate is required')
    .isISO8601()
    .withMessage('dueDate must be a valid ISO 8601 date'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('description must be at most 2000 characters'),
];

module.exports = { createHomeworkValidator };
