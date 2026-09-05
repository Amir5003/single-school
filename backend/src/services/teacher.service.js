const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('../models/User.model');
const Teacher = require('../models/Teacher.model');
const ClassTeacher = require('../models/ClassTeacher.model');
const School = require('../models/School.model');
const ApiError = require('../utils/ApiError');
const emailConflictError = require('../utils/emailConflict');
const logger = require('../utils/logger');

const MONGO_DUPLICATE_KEY = 11000;

// ── Service functions ────────────────────────────────────────────────────────

/**
 * Create a teacher User + Teacher profile in a single transaction.
 *
 * @param {{ name, email, phone, employeeId? }} data
 * @param {string} schoolId  Injected from req.school._id
 * @returns {Promise<{ user, teacher }>}
 */
const createTeacher = async (data, schoolId) => {
  const { name, email, phone, employeeId } = data;

  // Auto-generate employeeId if not provided
  let resolvedId;
  if (employeeId && employeeId.trim()) {
    resolvedId = employeeId.trim().toUpperCase();
  } else {
    const count = await Teacher.countDocuments({ schoolId });
    resolvedId = `TCH-${String(count + 1).padStart(3, '0')}`;
    // Ensure uniqueness in case of gaps (deleted teachers)
    let suffix = count + 1;
    while (await Teacher.exists({ schoolId, employeeId: resolvedId })) {
      suffix += 1;
      resolvedId = `TCH-${String(suffix).padStart(3, '0')}`;
    }
  }

  // Pre-flight duplicate checks
  const [dupEmployee, dupEmail] = await Promise.all([
    Teacher.findOne({ schoolId, employeeId: resolvedId }),
    User.findOne({ email }),
  ]);

  if (dupEmployee) {
    throw new ApiError(409, `Employee ID '${resolvedId}' is already in use`);
  }
  if (dupEmail) {
    throw emailConflictError(dupEmail, { schoolId, label: 'teacher' });
  }

  // Always generate a secure temp password — never accept one from the admin
  const tempPassword = crypto.randomBytes(8).toString('hex');

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const [user] = await User.create(
      [{ name, email, password: tempPassword, role: 'teacher', phone: phone || null, schoolId, mustChangePassword: true }],
      { session }
    );
    const [teacher] = await Teacher.create(
      [{ schoolId, userId: user._id, employeeId: resolvedId }],
      { session }
    );

    await session.commitTransaction();

    // Fire-and-forget email — never block the response.
    // School name looked up here (post-response) rather than threaded through
    // the service signature; see the equivalent note in student.service.js.
    setImmediate(async () => {
      const emailService = require('./email.service');
      let schoolName;
      try {
        const school = await School.findById(schoolId).select('name').lean();
        schoolName = school?.name;
      } catch (err) {
        logger.error(`[teacher.service] school name lookup failed for ${schoolId}: ${err.message}`);
      }
      emailService.sendTempPassword(email, name, tempPassword, schoolName).catch((err) => {
        logger.error(`Failed to send temp password email to ${email}: ${err.message}`);
      });
    });

    return { user, teacher };
  } catch (err) {
    await session.abortTransaction();

    if (err.code === MONGO_DUPLICATE_KEY) {
      const keyPattern = err.keyPattern || {};
      if ('employeeId' in keyPattern) {
        throw new ApiError(409, `Employee ID '${resolvedId}' is already in use`);
      }
      // Lost a race on the unique email index — same conflict, same message.
      throw emailConflictError(await User.findOne({ email }), { schoolId, label: 'teacher' });
    }
    throw err;
  } finally {
    session.endSession();
  }
};

/**
 * List all teachers with populated userId and class assignment count, scoped to a school.
 *
 * @param {string} schoolId
 * @returns {Promise<Array>}
 */
const listTeachers = async (schoolId) => {
  const [teachers, classCounts] = await Promise.all([
    Teacher.find({ schoolId }).populate('userId', 'name email phone role isActive').sort({ createdAt: -1 }),
    ClassTeacher.aggregate([
      { $match: { schoolId: new mongoose.Types.ObjectId(schoolId) } },
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
 * Get a single teacher by their Teacher _id, scoped to a school.
 *
 * @param {string} id  Teacher document _id
 * @param {string} schoolId
 */
const getTeacher = async (id, schoolId) => {
  const teacher = await Teacher.findOne({ _id: id, schoolId }).populate(
    'userId',
    'name email phone role isActive'
  );
  if (!teacher) {
    throw new ApiError(404, 'Teacher not found');
  }

  const assignments = await ClassTeacher.find({ schoolId, teacherId: id }).populate(
    'classId',
    'name grade section'
  );

  return { teacher, assignments };
};

/**
 * Partially update a teacher's profile.
 *
 * @param {string} id   Teacher document _id
 * @param {object} data Partial fields to update
 * @param {string} schoolId
 */
const updateTeacher = async (id, data, schoolId) => {
  const teacher = await Teacher.findOne({ _id: id, schoolId });
  if (!teacher) {
    throw new ApiError(404, 'Teacher not found');
  }

  const { name, phone, employeeId } = data;

  const userUpdate = {};
  if (name !== undefined) userUpdate.name = name;
  if (phone !== undefined) userUpdate.phone = phone;

  const teacherUpdate = {};
  if (employeeId !== undefined) {
    const normalized = employeeId.toUpperCase();
    const conflict = await Teacher.findOne({ schoolId, employeeId: normalized, _id: { $ne: id } });
    if (conflict) throw new ApiError(409, `Employee ID '${normalized}' is already in use`);
    teacherUpdate.employeeId = normalized;
  }

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
 * Delete a teacher, scoped to a school.
 *
 * @param {string} id  Teacher document _id
 * @param {string} schoolId
 */
const deleteTeacher = async (id, schoolId) => {
  const teacher = await Teacher.findOne({ _id: id, schoolId });
  if (!teacher) {
    throw new ApiError(404, 'Teacher not found');
  }

  const hasAssignments = await ClassTeacher.exists({ schoolId, teacherId: id });
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
 * Assign a teacher to a class for a specific subject, scoped to a school.
 *
 * @param {string} teacherId
 * @param {string} classId
 * @param {string} subject
 * @param {string} schoolId
 * @returns {Promise<ClassTeacher>}
 */
const assignToClass = async (teacherId, classId, subject, schoolId) => {
  const [teacher, cls, existing] = await Promise.all([
    Teacher.findOne({ _id: teacherId, schoolId }),
    mongoose.model('Class').findOne({ _id: classId, schoolId }),
    ClassTeacher.findOne({ schoolId, classId, teacherId, subject }),
  ]);

  if (!teacher) throw new ApiError(404, 'Teacher not found');
  if (!cls) throw new ApiError(404, 'Class not found');
  if (existing) {
    throw new ApiError(
      409,
      'Teacher is already assigned to this class for this subject'
    );
  }

  return ClassTeacher.create({ schoolId, classId, teacherId, subject });
};

// ── Teacher-facing helpers ────────────────────────────────────────────────────

/**
 * Resolve a Teacher document from the authenticated User _id.
 *
 * @param {string} userId  User._id from req.user
 * @param {string} schoolId
 * @returns {Promise<Teacher>}
 */
const getTeacherByUserId = async (userId, schoolId) => {
  const teacher = await Teacher.findOne({ userId, schoolId }).populate(
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
 * @param {string} schoolId
 * @returns {Promise<Array>}
 */
const getTeacherClasses = async (teacherId, schoolId) => {
  const assignments = await ClassTeacher.find({ schoolId, teacherId })
    .populate('classId', 'name grade section')
    .sort({ createdAt: 1 });

  // Student count per class via Student model
  const Student = mongoose.model('Student');
  const classIds = assignments.map((a) => a.classId?._id).filter(Boolean);
  const counts = await Student.aggregate([
    { $match: { schoolId: new mongoose.Types.ObjectId(schoolId), classId: { $in: classIds }, isDeleted: false } },
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
 * List students in a class (non-deleted), scoped to school.
 *
 * @param {string} classId
 * @param {string} schoolId
 * @returns {Promise<Array>}
 */
const getClassStudents = async (classId, schoolId) => {
  const Student = mongoose.model('Student');
  return Student.find({ schoolId, classId, isDeleted: false })
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
