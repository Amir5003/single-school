const mongoose = require('mongoose');
const Class = require('../models/Class.model');
const Student = require('../models/Student.model');
const ClassTeacher = require('../models/ClassTeacher.model');
const ApiError = require('../utils/ApiError');

// ── Service functions ────────────────────────────────────────────────────────

/**
 * Create a new class.
 *
 * @param {{ name, grade, section, academicYear }} data
 * @param {string} schoolId
 * @returns {Promise<Class>}
 */
const createClass = async (data, schoolId) => {
  const { name, grade, section, academicYear } = data;
  const normalizedSection = (section || '').toUpperCase();

  const [existingName, existingGradeSection] = await Promise.all([
    Class.findOne({ schoolId, name, academicYear }),
    Class.findOne({ schoolId, grade, section: normalizedSection, academicYear }),
  ]);
  if (existingName) {
    throw new ApiError(409, `A class '${name}' for ${academicYear} already exists`);
  }
  if (existingGradeSection) {
    throw new ApiError(409, `A class for grade ${grade} section ${normalizedSection} in ${academicYear} already exists`);
  }

  return Class.create({ schoolId, name, grade, section: normalizedSection, academicYear });
};

/**
 * List all classes with student count and teacher count, scoped to a school.
 *
 * @param {string} schoolId
 * @returns {Promise<Array>}
 */
const listClasses = async (schoolId) => {
  const classes = await Class.find({ schoolId }).sort({ grade: 1, section: 1 });

  const [studentCounts, teacherCounts] = await Promise.all([
    Student.aggregate([
      { $match: { schoolId: new mongoose.Types.ObjectId(schoolId), isDeleted: false, classId: { $ne: null } } },
      { $group: { _id: '$classId', count: { $sum: 1 } } },
    ]),
    ClassTeacher.aggregate([
      { $match: { schoolId: new mongoose.Types.ObjectId(schoolId) } },
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
 * Get a single class by ID, scoped to a school.
 *
 * @param {string} id  Class document _id
 * @param {string} schoolId
 */
const getClass = async (id, schoolId) => {
  const cls = await Class.findOne({ _id: id, schoolId });
  if (!cls) {
    throw new ApiError(404, 'Class not found');
  }

  const [students, assignments] = await Promise.all([
    Student.find({ schoolId, classId: id, isDeleted: false }).populate(
      'userId',
      'name email phone'
    ),
    ClassTeacher.find({ schoolId, classId: id }).populate({
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
 * @param {string} schoolId
 */
const updateClass = async (id, data, schoolId) => {
  const cls = await Class.findOne({ _id: id, schoolId });
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
 * Delete a class, scoped to a school.
 *
 * @param {string} id  Class document _id
 * @param {string} schoolId
 */
const deleteClass = async (id, schoolId) => {
  const cls = await Class.findOne({ _id: id, schoolId });
  if (!cls) {
    throw new ApiError(404, 'Class not found');
  }

  const hasStudents = await Student.exists({ schoolId, classId: id, isDeleted: false });
  if (hasStudents) {
    throw new ApiError(
      400,
      'Cannot delete class with active students assigned. Reassign or remove all students first.'
    );
  }

  await Class.findByIdAndDelete(id);
};

/**
 * Bulk-assign students to a class, scoped to a school.
 *
 * @param {string}   classId
 * @param {string[]} studentIds
 * @param {string}   schoolId
 * @returns {Promise<{ modifiedCount: number }>}
 */
const assignStudents = async (classId, studentIds, schoolId) => {
  const cls = await Class.findOne({ _id: classId, schoolId });
  if (!cls) {
    throw new ApiError(404, 'Class not found');
  }

  const result = await Student.updateMany(
    { schoolId, _id: { $in: studentIds }, isDeleted: false },
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
