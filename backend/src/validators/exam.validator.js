const { body } = require('express-validator');

const createExamValidator = [
  body('name').trim().notEmpty().withMessage('Exam name is required'),
  body('year')
    .isInt({ min: 2000, max: 2100 })
    .withMessage('Year must be a valid integer between 2000 and 2100'),
  body('term')
    .isIn(['Term 1', 'Term 2', 'Term 3', 'Mid-Year', 'Final'])
    .withMessage('Term must be one of: Term 1, Term 2, Term 3, Mid-Year, Final'),
  body('classId').isMongoId().withMessage('classId must be a valid MongoDB ObjectId'),
  body('subjects').isArray({ min: 1 }).withMessage('subjects must be a non-empty array'),
  body('subjects.*.name').trim().notEmpty().withMessage('Each subject must have a name'),
  body('subjects.*.totalMarks')
    .isInt({ min: 1 })
    .withMessage('Each subject totalMarks must be a positive integer'),
];

const updateExamValidator = [
  body('name').optional().trim().notEmpty().withMessage('Exam name cannot be empty'),
  body('year')
    .optional()
    .isInt({ min: 2000, max: 2100 })
    .withMessage('Year must be a valid integer'),
  body('term')
    .optional()
    .isIn(['Term 1', 'Term 2', 'Term 3', 'Mid-Year', 'Final'])
    .withMessage('Term must be one of: Term 1, Term 2, Term 3, Mid-Year, Final'),
  body('subjects').optional().isArray({ min: 1 }).withMessage('subjects must be a non-empty array'),
  body('subjects.*.name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Each subject must have a name'),
  body('subjects.*.totalMarks')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Each subject totalMarks must be a positive integer'),
];

module.exports = { createExamValidator, updateExamValidator };
