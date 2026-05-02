const { body } = require('express-validator');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Validators for POST /admin/timetable (create entry).
 */
const createTimetableValidator = [
  body('classId').isMongoId().withMessage('Valid class ID is required'),

  body('teacherId').isMongoId().withMessage('Valid teacher ID is required'),

  body('subject').trim().notEmpty().withMessage('Subject is required'),

  body('day').isIn(DAYS).withMessage(`Day must be one of: ${DAYS.join(', ')}`),

  body('startTime')
    .matches(TIME_REGEX)
    .withMessage('Start time must be in HH:MM format (e.g. 08:00)'),

  body('endTime')
    .matches(TIME_REGEX)
    .withMessage('End time must be in HH:MM format (e.g. 09:00)'),
];

/**
 * Validators for PUT /admin/timetable/:id (update – all fields optional).
 */
const updateTimetableValidator = [
  body('classId').optional().isMongoId().withMessage('Valid class ID is required'),

  body('teacherId').optional().isMongoId().withMessage('Valid teacher ID is required'),

  body('subject').optional().trim().notEmpty().withMessage('Subject cannot be empty'),

  body('day').optional().isIn(DAYS).withMessage(`Day must be one of: ${DAYS.join(', ')}`),

  body('startTime')
    .optional()
    .matches(TIME_REGEX)
    .withMessage('Start time must be in HH:MM format'),

  body('endTime')
    .optional()
    .matches(TIME_REGEX)
    .withMessage('End time must be in HH:MM format'),
];

module.exports = { createTimetableValidator, updateTimetableValidator };
