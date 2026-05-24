const { body } = require('express-validator');

const saveDraftValidator = [
  body('marks').isArray().withMessage('marks must be an array'),
  body('marks.*.studentId')
    .isMongoId()
    .withMessage('Each entry must have a valid studentId'),
  body('marks.*.marksObtained')
    .isFloat({ min: 0 })
    .withMessage('marksObtained must be a non-negative number'),
];

const reassignValidator = [
  body('teacherId').isMongoId().withMessage('teacherId must be a valid ObjectId'),
];

module.exports = { saveDraftValidator, reassignValidator };
