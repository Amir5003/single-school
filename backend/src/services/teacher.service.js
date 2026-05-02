const mongoose = require('mongoose');
const User = require('../models/User.model');
const Teacher = require('../models/Teacher.model');
const ClassTeacher = require('../models/ClassTeacher.model');
const ApiError = require('../utils/ApiError');

const MONGO_DUPLICATE_KEY = 11000;

// ── Service functions ────────────────────────────────────────────────────────

/**
 * Create a teacher User + Teacher profile in a single transaction.
 *
 * @param {{ name, email, password, phone, employeeId }} data
 * @returns {Promise<{ user, teacher }>}
 */
const createTeacher = async (data) => {
  const { name, email, password, phone, employeeId } = data;
  const normalizedId = (employeeId || '').toUpperCase();

  // Pre-flight duplicate checks
  const [dupEmployee, dupEmail] = await Promise.all([
    Teacher.findOne({ employeeId: normalizedId }),
    User.findOne({ email }),
  ]);

  if (dupEmployee) {
    throw new ApiError(409, `Employee ID '${normalizedId}' is already in use`);
  }
  if (dupEmail) {
    throw new ApiError(409, 'An account with this email already exists');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const [user] = await User.create(
      [{ name, email, password, role: 'teacher', phone: phone || null }],
      { session }
    );
    const [teacher] = await Teacher.create(
      [{ userId: user._id, employeeId: normalizedId }],
      { session }
    );

    await session.commitTransaction();
    return { user, teacher };
  } catch (err) {
    await session.abortTransaction();

    if (err.code === MONGO_DUPLICATE_KEY) {
      const field = Object.keys(err.keyPattern || {})[0];
      const label = field === 'employeeId' ? `Employee ID '${normalizedId}'` : 'email';
      throw new ApiError(409, `${label} is already in use`);
    }
    throw err;
  } finally {
    session.endSession();
  }
};

/**
 * List all teachers with populated userId and class assignment count.
 *
 * @returns {Promise<Array>}
 */
const listTeachers = async () => {
  const [teachers, classCounts] = await Promise.all([
    Teacher.find().populate('userId', 'name email phone role isActive').sort({ createdAt: -1 }),
    ClassTeacher.aggregate([
      { $group: { _id: '$teacherId', count: { $sum: 1 } } },
    ]),
  ]);

  const countMap = {};
  classCounts.forEach(({ _id, count }) => {
    countMap[_id.toString()] = count;
  });

  return teachers.map((t) => ({
    ...t.toJSON(),
    classCount: countMap[t._id.toString()] || 0,
  }));
};

/**
 * Get a single teacher by their Teacher _id, with class assignments.
 *
 * @param {string} id  Teacher document _id
 */
const getTeacher = async (id) => {
  const teacher = await Teacher.findById(id).populate(
    'userId',
    'name email phone role isActive'
  );
  if (!teacher) {
    throw new ApiError(404, 'Teacher not found');
  }

  const assignments = await ClassTeacher.find({ teacherId: id }).populate(
    'classId',
    'name grade section'
  );

  return { teacher, assignments };
};

/**
 * Partially update a teacher's profile.
 * User fields:    name, phone
 * Teacher fields: employeeId
 *
 * @param {string} id   Teacher document _id
 * @param {object} data Partial fields to update
 */
const updateTeacher = async (id, data) => {
  const teacher = await Teacher.findById(id);
  if (!teacher) {
    throw new ApiError(404, 'Teacher not found');
  }

  const { name, phone, employeeId } = data;

  const userUpdate = {};
  if (name !== undefined) userUpdate.name = name;
  if (phone !== undefined) userUpdate.phone = phone;

  const teacherUpdate = {};
  if (employeeId !== undefined) teacherUpdate.employeeId = employeeId.toUpperCase();

  await Promise.all([
    Object.keys(userUpdate).length > 0
      ? User.findByIdAndUpdate(teacher.userId, { $set: userUpdate })
      : Promise.resolve(),
    Object.keys(teacherUpdate).length > 0
      ? Teacher.findByIdAndUpdate(id, { $set: teacherUpdate })
      : Promise.resolve(),
  ]);

  const updated = await Teacher.findById(id).populate(
    'userId',
    'name email phone role isActive'
  );
  return updated;
};

/**
 * Delete a teacher.
 * Blocked if the teacher has active class assignments (ClassTeacher records).
 *
 * @param {string} id  Teacher document _id
 */
const deleteTeacher = async (id) => {
  const teacher = await Teacher.findById(id);
  if (!teacher) {
    throw new ApiError(404, 'Teacher not found');
  }

  const hasAssignments = await ClassTeacher.exists({ teacherId: id });
  if (hasAssignments) {
    throw new ApiError(
      400,
      'Cannot delete teacher with active class assignments. Remove all class assignments first.'
    );
  }

  await Promise.all([
    Teacher.findByIdAndDelete(id),
    User.findByIdAndUpdate(teacher.userId, { isActive: false }),
  ]);
};

/**
 * Assign a teacher to a class for a specific subject.
 * Throws ApiError(409) if the exact combination already exists.
 *
 * @param {string} teacherId
 * @param {string} classId
 * @param {string} subject
 * @returns {Promise<ClassTeacher>}
 */
const assignToClass = async (teacherId, classId, subject) => {
  const [teacher, cls, existing] = await Promise.all([
    Teacher.findById(teacherId),
    mongoose.model('Class').findById(classId),
    ClassTeacher.findOne({ classId, teacherId, subject }),
  ]);

  if (!teacher) throw new ApiError(404, 'Teacher not found');
  if (!cls) throw new ApiError(404, 'Class not found');
  if (existing) {
    throw new ApiError(
      409,
      'Teacher is already assigned to this class for this subject'
    );
  }

  return ClassTeacher.create({ classId, teacherId, subject });
};

// ── Teacher-facing helpers ────────────────────────────────────────────────────

/**
 * Resolve a Teacher document from the authenticated User _id.
 * Used in teacher-scoped routes where req.user._id is a User._id.
 *
 * @param {string} userId  User._id from req.user
 * @returns {Promise<Teacher>}
 */
const getTeacherByUserId = async (userId) => {
  const teacher = await Teacher.findOne({ userId }).populate(
    'userId',
    'name email phone'
  );
  if (!teacher) {
    throw new ApiError(404, 'Teacher profile not found');
  }
  return teacher;
};

/**
 * List classes assigned to a teacher, with student count per class.
 *
 * @param {string} teacherId  Teacher._id
 * @returns {Promise<Array>}
 */
const getTeacherClasses = async (teacherId) => {
  const assignments = await ClassTeacher.find({ teacherId })
    .populate('classId', 'name grade section')
    .sort({ createdAt: 1 });

  // Student count per class via Student model
  const Student = mongoose.model('Student');
  const classIds = assignments.map((a) => a.classId?._id).filter(Boolean);
  const counts = await Student.aggregate([
    { $match: { classId: { $in: classIds }, isDeleted: false } },
    { $group: { _id: '$classId', count: { $sum: 1 } } },
  ]);
  const countMap = {};
  counts.forEach(({ _id, count }) => {
    countMap[_id.toString()] = count;
  });

  return assignments.map((a) => ({
    classId: a.classId,
    subject: a.subject,
    studentCount: countMap[a.classId?._id?.toString()] || 0,
  }));
};

/**
 * List students in a class (non-deleted), with user names.
 *
 * @param {string} classId
 * @returns {Promise<Array>}
 */
const getClassStudents = async (classId) => {
  const Student = mongoose.model('Student');
  return Student.find({ classId, isDeleted: false })
    .populate('userId', 'name email')
    .sort({ createdAt: 1 });
};

module.exports = {
  createTeacher,
  listTeachers,
  getTeacher,
  updateTeacher,
  deleteTeacher,
  assignToClass,
  getTeacherByUserId,
  getTeacherClasses,
  getClassStudents,
};
