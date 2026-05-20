const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('../models/User.model');
const Student = require('../models/Student.model');
// Class model must be registered before any Student.populate('classId') call
require('../models/Class.model');
const Timetable = require('../models/Timetable.model');
const Attendance = require('../models/Attendance.model');
const Marks = require('../models/Marks.model');
const Announcement = require('../models/Announcement.model');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

const MONGO_DUPLICATE_KEY = 11000;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Populate userId and classId on a Student query. */
const populateStudent = (query) =>
  query
    .populate('userId', 'name email phone role isActive')
    .populate('classId', 'name section');

// ── Service functions ────────────────────────────────────────────────────────

/**
 * Create a student User + Student profile in a single transaction.
 *
 * @param {{ name, email, password, phone, enrollmentId, dateOfBirth, address }} data
 * @param {string} schoolId  Injected from req.school._id — never from req.body
 * @returns {Promise<{ user, student }>}
 */
const createStudent = async (data, schoolId) => {
  const { name, email, phone, enrollmentId, dateOfBirth, address, password } = data;
  const normalizedId = (enrollmentId || '').toUpperCase();

  // Pre-flight duplicate checks (cheaper than letting the DB throw 11000)
  const [dupEnrollment, dupEmail] = await Promise.all([
    Student.findOne({ schoolId, enrollmentId: normalizedId }),
    User.findOne({ email }),
  ]);

  if (dupEnrollment) {
    throw new ApiError(409, `Enrollment ID '${normalizedId}' is already in use`);
  }
  if (dupEmail) {
    throw new ApiError(409, 'An account with this email already exists');
  }

  // Use admin-provided password if given; otherwise generate a secure temp password
  const tempPassword = password || crypto.randomBytes(6).toString('hex'); // 12 hex chars

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Mongoose requires array form when passing a session to create()
    const [user] = await User.create(
      [{ name, email, password: tempPassword, role: 'student', phone: phone || null, schoolId, mustChangePassword: true }],
      { session }
    );
    const [student] = await Student.create(
      [{ schoolId, userId: user._id, enrollmentId: normalizedId, dateOfBirth, address: address || null }],
      { session }
    );

    await session.commitTransaction();

    // Fire-and-forget email — never block the response
    setImmediate(() => {
      const emailService = require('./email.service');
      emailService.sendTempPassword(email, name, tempPassword).catch((err) => {
        logger.error(`Failed to send temp password email to ${email}: ${err.message}`);
      });
    });

    return { user, student };
  } catch (err) {
    await session.abortTransaction();

    if (err.code === MONGO_DUPLICATE_KEY) {
      const field = Object.keys(err.keyPattern || {})[0];
      const label =
        field === 'enrollmentId'
          ? `Enrollment ID '${normalizedId}'`
          : 'email';
      throw new ApiError(409, `${label} is already in use`);
    }
    throw err;
  } finally {
    session.endSession();
  }
};

/**
 * List students with optional search and pagination, scoped to a school.
 *
 * @param {{ page?: number, limit?: number, search?: string }} options
 * @param {string} schoolId
 * @returns {Promise<{ students, total, page, limit, totalPages }>}
 */
const listStudents = async ({ page = 1, limit = 20, search = '' } = {}, schoolId) => {
  const skip = (Number(page) - 1) * Number(limit);
  const filter = { schoolId, isDeleted: false };

  if (search && search.trim()) {
    const regex = new RegExp(search.trim(), 'i');
    const matchingUsers = await User.find(
      { name: regex, role: 'student', schoolId },
      '_id'
    );
    const userIds = matchingUsers.map((u) => u._id);

    filter.$or = [{ enrollmentId: regex }, { userId: { $in: userIds } }];
  }

  const [students, total] = await Promise.all([
    populateStudent(
      Student.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit))
    ),
    Student.countDocuments(filter),
  ]);

  return {
    students,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / Number(limit)),
  };
};

/**
 * Get a single student by their Student _id, scoped to a school.
 *
 * @param {string} id  Student document _id
 * @param {string} schoolId
 */
const getStudent = async (id, schoolId) => {
  const student = await populateStudent(
    Student.findOne({ _id: id, schoolId, isDeleted: false })
  );
  if (!student) {
    throw new ApiError(404, 'Student not found');
  }
  return student;
};

/**
 * Partially update a student's profile.
 *
 * @param {string} id   Student document _id
 * @param {object} data Partial fields to update
 * @param {string} schoolId
 */
const updateStudent = async (id, data, schoolId) => {
  const student = await Student.findOne({ _id: id, schoolId, isDeleted: false });
  if (!student) {
    throw new ApiError(404, 'Student not found');
  }

  const { name, phone, enrollmentId, dateOfBirth, address } = data;

  const userUpdate = {};
  if (name !== undefined) userUpdate.name = name;
  if (phone !== undefined) userUpdate.phone = phone;

  const studentUpdate = {};
  if (enrollmentId !== undefined) studentUpdate.enrollmentId = enrollmentId.toUpperCase();
  if (dateOfBirth !== undefined) studentUpdate.dateOfBirth = dateOfBirth;
  if (address !== undefined) studentUpdate.address = address;

  await Promise.all([
    Object.keys(userUpdate).length > 0
      ? User.findByIdAndUpdate(student.userId, { $set: userUpdate })
      : Promise.resolve(),
    Object.keys(studentUpdate).length > 0
      ? Student.findByIdAndUpdate(id, { $set: studentUpdate })
      : Promise.resolve(),
  ]);

  return populateStudent(Student.findById(id));
};

/**
 * Soft-delete a student.
 *
 * @param {string} id  Student document _id
 * @param {string} schoolId
 */
const softDeleteStudent = async (id, schoolId) => {
  const student = await Student.findOne({ _id: id, schoolId });
  if (!student || student.isDeleted) {
    throw new ApiError(404, 'Student not found');
  }

  // Guard: check for related Attendance and Marks records.
  // Models may not be registered yet in earlier phases — use mongoose.models for safe lookup.
  const AttendanceModel = mongoose.models.Attendance;
  const MarksModel = mongoose.models.Marks;

  const [attendanceCount, marksCount] = await Promise.all([
    AttendanceModel
      ? AttendanceModel.countDocuments({ studentId: student._id })
      : Promise.resolve(0),
    MarksModel
      ? MarksModel.countDocuments({ studentId: student._id })
      : Promise.resolve(0),
  ]);

  if (attendanceCount > 0 || marksCount > 0) {
    throw new ApiError(
      400,
      'This student has existing attendance or marks records. ' +
        'Their data will be preserved for audit purposes, but the account cannot be removed. ' +
        'Deleting the account will deactivate their login access.'
    );
  }

  await Promise.all([
    Student.findByIdAndUpdate(id, { isDeleted: true, deletedAt: new Date() }),
    User.findByIdAndUpdate(student.userId, { isActive: false }),
  ]);
};

// ── Student self-read functions ───────────────────────────────────────────────

/**
 * Get a student's own profile, scoped by their User._id and school.
 *
 * @param {string} userId  User._id from JWT
 * @param {string} schoolId
 * @returns {Promise<Student>}
 */
const getStudentProfile = async (userId, schoolId) => {
  const student = await Student.findOne({ userId, schoolId, isDeleted: false })
    .populate('userId', 'name email phone role isActive')
    .populate('classId', 'name grade section');

  if (!student) {
    throw new ApiError(404, 'Student profile not found');
  }
  return student;
};

/**
 * Get timetable for the student's class, scoped to the school.
 *
 * @param {string} userId
 * @param {string} schoolId
 * @returns {Promise<Timetable[]>}
 */
const getStudentTimetable = async (userId, schoolId) => {
  const student = await Student.findOne({ userId, schoolId, isDeleted: false }, 'classId');
  if (!student || !student.classId) {
    return [];
  }

  return Timetable.find({ schoolId, classId: student.classId })
    .populate({
      path: 'teacherId',
      select: 'userId',
      populate: { path: 'userId', select: 'name' },
    })
    .sort({ day: 1, startTime: 1 });
};

/**
 * Get attendance records for a student, optionally filtered by month.
 *
 * @param {string} userId
 * @param {string} [month]  "YYYY-MM"
 * @param {string} schoolId
 * @returns {Promise<{ totalDays, presentDays, absentDays, leaveDays, percentage, records }>}
 */
const getStudentAttendance = async (userId, month, schoolId) => {
  const student = await Student.findOne({ userId, schoolId, isDeleted: false }, '_id');
  if (!student) {
    throw new ApiError(404, 'Student profile not found');
  }

  const filter = { schoolId, studentId: student._id };

  if (month) {
    // Validate YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new ApiError(400, 'month must be in YYYY-MM format');
    }
    const [year, mon] = month.split('-').map(Number);
    const start = new Date(Date.UTC(year, mon - 1, 1));
    const end = new Date(Date.UTC(year, mon, 1)); // exclusive
    filter.date = { $gte: start, $lt: end };
  }

  const records = await Attendance.find(filter)
    .sort({ date: -1 })
    .select('date status');

  const totalDays = records.length;
  const presentDays = records.filter((r) => r.status === 'Present').length;
  const absentDays = records.filter((r) => r.status === 'Absent').length;
  const leaveDays = records.filter((r) => r.status === 'Leave').length;
  const percentage =
    totalDays === 0
      ? 0
      : parseFloat(((presentDays / totalDays) * 100).toFixed(2));

  return { totalDays, presentDays, absentDays, leaveDays, percentage, records };
};

/**
 * Get all marks for a student, scoped to the school.
 *
 * @param {string} userId
 * @param {string} schoolId
 * @returns {Promise<{ marks, overallPercentage }>}
 */
const getStudentMarks = async (userId, schoolId) => {
  const student = await Student.findOne({ userId, schoolId, isDeleted: false }, '_id');
  if (!student) {
    throw new ApiError(404, 'Student profile not found');
  }

  const marks = await Marks.find({ schoolId, studentId: student._id })
    .sort({ createdAt: -1 })
    .select('subject examType marksObtained maxMarks');

  let totalObtained = 0;
  let totalMax = 0;
  marks.forEach((m) => {
    totalObtained += m.marksObtained;
    totalMax += m.maxMarks;
  });

  const overallPercentage =
    totalMax === 0
      ? 0
      : parseFloat(((totalObtained / totalMax) * 100).toFixed(2));

  return { marks, overallPercentage };
};

/**
 * Get latest 20 active announcements for students to read, scoped to the school.
 *
 * @param {string} schoolId
 * @returns {Promise<Announcement[]>}
 */
const getStudentAnnouncements = async (schoolId) => {
  return Announcement.find({ schoolId, isDeleted: false, targetRole: { $in: ['all', 'student'] } })
    .populate({
      path: 'teacherId',
      select: 'userId',
      populate: { path: 'userId', select: 'name' },
    })
    .sort({ createdAt: -1 })
    .limit(20);
};

module.exports = {
  createStudent,
  listStudents,
  getStudent,
  updateStudent,
  softDeleteStudent,
  getStudentProfile,
  getStudentTimetable,
  getStudentAttendance,
  getStudentMarks,
  getStudentAnnouncements,
};
