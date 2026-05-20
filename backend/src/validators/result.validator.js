const { body } = require('express-validator');

const upsertResultsValidator = [
  body()
    .isArray({ min: 1 })
    .withMessage('Request body must be a non-empty array of student results'),
  body('*.studentId')
    .isMongoId()
    .withMessage('Each entry must have a valid studentId (MongoDB ObjectId)'),
  body('*.marks').isArray({ min: 1 }).withMessage('Each entry must have a marks array'),
  body('*.marks.*.subject')
    .trim()
    .notEmpty()
    .withMessage('Each mark entry must have a subject'),
  body('*.marks.*.marksObtained')
    .isFloat({ min: 0 })
    .withMessage('marksObtained must be a non-negative number'),
];

module.exports = { upsertResultsValidator };
