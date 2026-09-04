const ParentStudentLink = require('../models/ParentStudentLink.model');
const Attendance = require('../models/Attendance.model');
const assessmentService = require('./assessment.service');
const Fee = require('../models/Fee.model');
const Homework = require('../models/Homework.model');
const Notification = require('../models/Notification.model');
const examService = require('./exam.service');
const resultService = require('./result.service');
const ApiError = require('../utils/ApiError');

/**
 * Verify that a link exists between the parent and the student within the school.
 * Throws 403 if the parent is not linked to this student in this school.
 *
 * @param {string} parentId
 * @param {string} studentId
 * @param {string} schoolId
 * @returns {Promise<ParentStudentLink>}
 */
const requireLink = async (parentId, studentId, schoolId) => {
  const link = await ParentStudentLink.findOne({ parentId, studentId, schoolId });
  if (!link) throw new ApiError(403, 'You are not linked to this student');
  return link;
};

/**
 * Get all students linked to a parent within a school.
 *
 * @param {string} parentId
 * @param {string} schoolId
 * @returns {Promise<Array>}
 */
const getChildren = async (parentId, schoolId) => {
  const links = await ParentStudentLink.find({ parentId, schoolId })
    .populate({
      path: 'studentId',
      populate: { path: 'userId', select: 'name email' },
    })
    .lean();

  return links.map((l) => l.studentId);
};

/**
 * Get attendance records for a child (after verifying parent-student link).
 *
 * @param {string} parentId
 * @param {string} studentId
 * @param {string} schoolId
 * @returns {Promise<Array>}
 */
const getChildAttendance = async (parentId, studentId, schoolId) => {
  await requireLink(parentId, studentId, schoolId);
  return Attendance.find({ schoolId, studentId }).sort({ date: -1 }).lean();
};

/**
 * Get a child's coursework, grouped by subject (after verifying the link).
 * Delegates to the same service the student route uses.
 *
 * @param {string} parentId
 * @param {string} studentId
 * @param {string} schoolId
 * @returns {Promise<{ subjects, overallPercentage, totalCount }>}
 */
const getChildCoursework = async (parentId, studentId, schoolId) => {
  await requireLink(parentId, studentId, schoolId);
  return assessmentService.getStudentCoursework(schoolId, studentId);
};

/**
 * Get fee records for a child (after verifying parent-student link).
 *
 * @param {string} parentId
 * @param {string} studentId
 * @param {string} schoolId
 * @returns {Promise<Array>}
 */
const getChildFees = async (parentId, studentId, schoolId) => {
  await requireLink(parentId, studentId, schoolId);
  return Fee.find({ schoolId, studentId }).sort({ dueDate: -1 }).lean();
};

/**
 * Get homework for a child's class (after verifying parent-student link).
 *
 * @param {string} parentId
 * @param {string} studentId
 * @param {string} schoolId
 * @returns {Promise<Array>}
 */
const getChildHomework = async (parentId, studentId, schoolId) => {
  const link = await requireLink(parentId, studentId, schoolId);
  // Populate student to get classId
  const populated = await ParentStudentLink.findById(link._id)
    .populate('studentId', 'classId')
    .lean();

  const { classId } = populated.studentId;
  if (!classId) return [];

  return Homework.find({ schoolId, classId, isDeleted: false })
    .sort({ dueDate: -1 })
    .lean();
};

/**
 * Get notifications relevant to a child's school (targetRole: 'all', 'student', 'parent').
 *
 * @param {string} parentId
 * @param {string} studentId
 * @param {string} schoolId
 * @returns {Promise<Array>}
 */
const getChildNotifications = async (parentId, studentId, schoolId) => {
  await requireLink(parentId, studentId, schoolId);
  return Notification.find({
    schoolId,
    targetRole: { $in: ['all', 'parent'] },
  })
    .sort({ createdAt: -1 })
    .lean();
};

/**
 * Report-card access for a linked child.
 *
 * These four functions are deliberately thin delegations to the same services
 * the student routes use. Reusing them is what keeps publication gating from
 * drifting between what a student sees and what their parent sees — an
 * unpublished exam 404s for both, from one implementation.
 */

/**
 * Distinct years that have at least one published exam.
 */
const getChildExamYears = async (parentId, studentId, schoolId) => {
  await requireLink(parentId, studentId, schoolId);
  return examService.getDistinctYears(schoolId);
};

/**
 * Published exams for the child's class, optionally filtered by year.
 */
const getChildExams = async (parentId, studentId, schoolId, year) => {
  await requireLink(parentId, studentId, schoolId);
  return examService.getExamsForStudent(schoolId, studentId, year);
};

/**
 * The child's result for one published exam, with per-subject pass/fail.
 */
const getChildResult = async (parentId, studentId, schoolId, examId) => {
  await requireLink(parentId, studentId, schoolId);
  return resultService.getStudentResult(schoolId, studentId, examId);
};

/**
 * Report-card payload (branding + marks + totals) for client-side PDF render.
 */
const getChildReportCard = async (parentId, studentId, schoolId, examId) => {
  await requireLink(parentId, studentId, schoolId);
  return examService.buildReportCardPayload(schoolId, studentId, examId);
};

module.exports = {
  getChildren,
  getChildAttendance,
  getChildCoursework,
  getChildFees,
  getChildHomework,
  getChildNotifications,
  getChildExamYears,
  getChildExams,
  getChildResult,
  getChildReportCard,
};
