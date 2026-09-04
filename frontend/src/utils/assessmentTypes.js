/**
 * Coursework assessment types — must stay in sync with the `assessmentType`
 * enum on backend/src/models/Assessment.model.js.
 *
 * Term exams (midterm, final) are deliberately absent: those belong to the
 * Exam → Report Card pipeline, which gates student visibility on an admin
 * publish step. See specs/008-coursework-report-cards/.
 */
export const ASSESSMENT_TYPES = [
  'class_test',
  'quiz',
  'assignment',
  'project',
  'practical',
];

const LABELS = {
  class_test: 'Class Test',
  quiz: 'Quiz',
  assignment: 'Assignment',
  project: 'Project',
  practical: 'Practical',
};

/**
 * Human label for a stored assessment type. Values are snake_case on the wire,
 * so never render one raw.
 *
 * @param {string} type
 * @returns {string}
 */
export const assessmentTypeLabel = (type) => LABELS[type] ?? type ?? '';

export default ASSESSMENT_TYPES;
