const mongoose = require('mongoose');
const Class = require('../models/Class.model');
const Student = require('../models/Student.model');
const ClassTeacher = require('../models/ClassTeacher.model');
const ApiError = require('../utils/ApiError');

// ── Service functions ────────────────────────────────────────────────────────

/**
 * Create a new class.
 * Throws ApiError(409) on duplicate {grade, section}.
 *
 * @param {{ name, grade, section }} data
 * @returns {Promise<Class>}
 */
const createClass = async (data) => {
  const { name, grade, section } = data;
  const normalizedSection = (section || '').toUpperCase();

  const existing = await Class.findOne({ grade, section: normalizedSection });
  if (existing) {
    throw new ApiError(409, `A class for Grade ${grade} Section ${normalizedSection} already exists`);
  }

  return Class.create({ name, grade, section: normalizedSection });
};

/**
 * List all classes with student count and teacher count.
 *
 * @returns {Promise<Array>}
 */
const listClasses = async () => {
  const classes = await Class.find().sort({ grade: 1, section: 1 });

  // Aggregate student and teacher counts per class in parallel
  const [studentCounts, teacherCounts] = await Promise.all([
    Student.aggregate([
      { $match: { isDeleted: false, classId: { $ne: null } } },
      { $group: { _id: '$classId', count: { $sum: 1 } } },
    ]),
    ClassTeacher.aggregate([
      { $group: { _id: '$classId', count: { $sum: 1 } } },
    ]),
  ]);

  const studentCountMap = {};
  studentCounts.forEach(({ _id, count }) => {
    studentCountMap[_id.toString()] = count;
  });

  const teacherCountMap = {};
  teacherCounts.forEach(({ _id, count }) => {
    teacherCountMap[_id.toString()] = count;
  });

  return classes.map((c) => ({
    ...c.toJSON(),
    studentCount: studentCountMap[c._id.toString()] || 0,
    teacherCount: teacherCountMap[c._id.toString()] || 0,
  }));
};

/**
 * Get a single class by ID with its assigned students and teacher assignments.
 *
 * @param {string} id  Class document _id
 */
const getClass = async (id) => {
  const cls = await Class.findById(id);
  if (!cls) {
    throw new ApiError(404, 'Class not found');
  }

  const [students, assignments] = await Promise.all([
    Student.find({ classId: id, isDeleted: false }).populate(
      'userId',
      'name email phone'
    ),
    ClassTeacher.find({ classId: id }).populate({
      path: 'teacherId',
      populate: { path: 'userId', select: 'name email' },
    }),
  ]);

  return { cls, students, assignments };
};

/**
 * Partially update a class record.
 *
 * @param {string} id   Class document _id
 * @param {object} data Partial fields to update
 */
const updateClass = async (id, data) => {
  const cls = await Class.findById(id);
  if (!cls) {
    throw new ApiError(404, 'Class not found');
  }

  const update = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.grade !== undefined) update.grade = data.grade;
  if (data.section !== undefined) update.section = data.section.toUpperCase();

  return Class.findByIdAndUpdate(id, { $set: update }, { new: true });
};

/**
 * Delete a class.
 * Blocked if there are active (non-deleted) students assigned to it.
 *
 * @param {string} id  Class document _id
 */
const deleteClass = async (id) => {
  const cls = await Class.findById(id);
  if (!cls) {
    throw new ApiError(404, 'Class not found');
  }

  const hasStudents = await Student.exists({ classId: id, isDeleted: false });
  if (hasStudents) {
    throw new ApiError(
      400,
      'Cannot delete class with active students assigned. Reassign or remove all students first.'
    );
  }

  await Class.findByIdAndDelete(id);
};

/**
 * Bulk-assign students to a class.
 * Updates Student.classId for all provided student IDs.
 *
 * @param {string}   classId
 * @param {string[]} studentIds
 * @returns {Promise<{ modifiedCount: number }>}
 */
const assignStudents = async (classId, studentIds) => {
  const cls = await Class.findById(classId);
  if (!cls) {
    throw new ApiError(404, 'Class not found');
  }

  const result = await Student.updateMany(
    { _id: { $in: studentIds }, isDeleted: false },
    { $set: { classId } }
  );

  return { modifiedCount: result.modifiedCount };
};

module.exports = {
  createClass,
  listClasses,
  getClass,
  updateClass,
  deleteClass,
  assignStudents,
};
