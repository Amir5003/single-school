const { body } = require('express-validator');

/**
 * Validators for POST /admin/classes (create).
 */
const createClassValidator = [
  body('name').trim().notEmpty().withMessage('Class name is required'),

  body('grade').trim().notEmpty().withMessage('Grade is required'),

  body('section')
    .trim()
    .notEmpty()
    .withMessage('Section is required')
    .isLength({ max: 5 })
    .withMessage('Section cannot exceed 5 characters'),

  body('academicYear')
    .trim()
    .notEmpty()
    .withMessage('Academic year is required'),
];

/**
 * Validators for PUT /admin/classes/:id (update – all fields optional).
 */
const updateClassValidator = [
  body('name').optional().trim().notEmpty().withMessage('Class name cannot be empty'),

  body('grade').optional().trim().notEmpty().withMessage('Grade cannot be empty'),

  body('section')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Section cannot be empty')
    .isLength({ max: 5 })
    .withMessage('Section cannot exceed 5 characters'),
];

/**
 * Validators for POST /admin/classes/:id/assign-teacher
 */
const assignTeacherValidator = [
  body('teacherId').isMongoId().withMessage('Valid teacher ID is required'),
  body('subject').trim().notEmpty().withMessage('Subject is required'),
];

/**
 * Validators for POST /admin/classes/:id/assign-students
 */
const assignStudentsValidator = [
  body('studentIds')
    .isArray({ min: 1 })
    .withMessage('studentIds must be a non-empty array')
    .custom((ids) => ids.every((id) => /^[0-9a-fA-F]{24}$/.test(id)))
    .withMessage('All studentIds must be valid MongoDB Object IDs'),
];

module.exports = {
  createClassValidator,
  updateClassValidator,
  assignTeacherValidator,
  assignStudentsValidator,
};
