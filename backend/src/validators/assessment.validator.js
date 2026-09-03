const { body } = require('express-validator');

const ASSESSMENT_TYPES = ['class_test', 'quiz', 'assignment', 'project', 'practical'];

const createAssessmentValidator = [
  body('classId').isMongoId().withMessage('classId must be a valid id'),
  body('subject').trim().notEmpty().withMessage('subject is required'),
  body('title')
    .trim()
    .notEmpty()
    .withMessage('title is required')
    .isLength({ max: 120 })
    .withMessage('title cannot exceed 120 characters'),
  body('assessmentType')
    .optional()
    .isIn(ASSESSMENT_TYPES)
    .withMessage(`assessmentType must be one of: ${ASSESSMENT_TYPES.join(', ')}`),
  body('maxMarks').isInt({ min: 1 }).withMessage('maxMarks must be at least 1'),
  body('date').optional().isISO8601().withMessage('date must be a valid date'),
];

const updateAssessmentValidator = [
  body('subject').optional().trim().notEmpty().withMessage('subject cannot be empty'),
  body('title')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('title cannot be empty')
    .isLength({ max: 120 })
    .withMessage('title cannot exceed 120 characters'),
  body('assessmentType')
    .optional()
    .isIn(ASSESSMENT_TYPES)
    .withMessage(`assessmentType must be one of: ${ASSESSMENT_TYPES.join(', ')}`),
  body('maxMarks').optional().isInt({ min: 1 }).withMessage('maxMarks must be at least 1'),
  body('date').optional().isISO8601().withMessage('date must be a valid date'),
];

const saveScoresValidator = [
  body('scores').isArray().withMessage('scores must be an array'),
  body('scores.*.studentId').isMongoId().withMessage('each score needs a valid studentId'),
  body('scores.*.marksObtained')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('marksObtained cannot be negative'),
  body('scores.*.absent').optional().isBoolean().withMessage('absent must be a boolean'),
  body('scores.*.remarks')
    .optional()
    .isLength({ max: 300 })
    .withMessage('remarks cannot exceed 300 characters'),
];

module.exports = {
  createAssessmentValidator,
  updateAssessmentValidator,
  saveScoresValidator,
};
