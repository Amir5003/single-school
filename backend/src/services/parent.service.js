const ParentStudentLink = require('../models/ParentStudentLink.model');
const Attendance = require('../models/Attendance.model');
const Marks = require('../models/Marks.model');
const Fee = require('../models/Fee.model');
const Homework = require('../models/Homework.model');
const Notification = require('../models/Notification.model');
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
 * Get marks for a child (after verifying parent-student link).
 *
 * @param {string} parentId
 * @param {string} studentId
 * @param {string} schoolId
 * @returns {Promise<Array>}
 */
const getChildMarks = async (parentId, studentId, schoolId) => {
  await requireLink(parentId, studentId, schoolId);
  return Marks.find({ schoolId, studentId }).sort({ createdAt: -1 }).lean();
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

module.exports = {
  getChildren,
  getChildAttendance,
  getChildMarks,
  getChildFees,
  getChildHomework,
  getChildNotifications,
};
