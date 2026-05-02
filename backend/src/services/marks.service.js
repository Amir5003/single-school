const Marks = require('../models/Marks.model');
const ClassTeacher = require('../models/ClassTeacher.model');
const ApiError = require('../utils/ApiError');

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Verify the teacher is assigned to the given class.
 * Throws ApiError(403) if not.
 *
 * @param {string} classId
 * @param {string} teacherId
 */
const assertAssigned = async (classId, teacherId) => {
  const assigned = await ClassTeacher.exists({ classId, teacherId });
  if (!assigned) {
    throw new ApiError(403, 'You are not assigned to this class');
  }
};

// ── Service functions ────────────────────────────────────────────────────────

/**
 * Insert or update a mark entry.
 * Unique key: studentId + subject + classId + examType.
 *
 * @param {{ studentId, classId, subject, examType, marksObtained, maxMarks }} data
 * @param {string} teacherId  Teacher._id (used for class authorization)
 * @returns {Promise<Marks>}
 */
const upsertMark = async (data, teacherId) => {
  const { studentId, classId, subject, examType = 'final', marksObtained, maxMarks } = data;

  await assertAssigned(classId, teacherId);

  const mark = await Marks.findOneAndUpdate(
    { studentId, subject, classId, examType },
    { $set: { marksObtained, maxMarks: maxMarks ?? 100 } },
    { upsert: true, new: true, runValidators: true }
  );

  return mark;
};

/**
 * Get all marks for a class filtered by subject, with student names populated.
 *
 * @param {string} classId
 * @param {string} subject
 * @param {string} teacherId
 * @returns {Promise<Marks[]>}
 */
const getMarksByClass = async (classId, subject, teacherId) => {
  await assertAssigned(classId, teacherId);

  return Marks.find({ classId, subject })
    .populate({
      path: 'studentId',
      select: 'enrollmentId',
      populate: { path: 'userId', select: 'name' },
    })
    .sort({ createdAt: 1 });
};

module.exports = { upsertMark, getMarksByClass };
