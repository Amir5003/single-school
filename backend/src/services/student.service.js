const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('../models/User.model');
const Student = require('../models/Student.model');
// Class model must be registered before any Student.populate('classId') call
const Class = require('../models/Class.model');
const Timetable = require('../models/Timetable.model');
const Attendance = require('../models/Attendance.model');
const assessmentService = require('./assessment.service');
const Announcement = require('../models/Announcement.model');
const { notExpiredFilter } = require('./announcement.service');
const ApiError = require('../utils/ApiError');
const emailConflictError = require('../utils/emailConflict');
const logger = require('../utils/logger');
const studentCountService = require('./subscription/studentCount.service');

const MONGO_DUPLICATE_KEY = 11000;

// Enrollment IDs are "YY-NNNNNN" — e.g. 26-000001 for the first student of 2026.
const ENROLLMENT_SEQ_WIDTH = 6;
// A generated ID can lose a race with a concurrent create. The unique index is
// the arbiter, so we recompute and retry rather than locking anything up front.
const MAX_ENROLLMENT_ATTEMPTS = 5;


// ── Helpers ──────────────────────────────────────────────────────────────────

/** Populate userId and classId on a Student query. */
const populateStudent = (query) =>
  query
    .populate('userId', 'name email phone role isActive')
    .populate('classId', 'name section');

/**
 * Resolve an incoming classId to a value safe to persist.
 *
 * Returns null for an empty value (explicitly unassigned) and throws if the
 * class does not exist in THIS school — without the schoolId check an admin
 * could park a student in another tenant's class.
 */
const resolveClassId = async (classId, schoolId) => {
  if (classId === undefined || classId === null || classId === '') return null;

  const exists = await Class.exists({ _id: classId, schoolId });
  if (!exists) {
    throw new ApiError(404, 'Class not found');
  }
  return classId;
};

/** Build an enrollment ID from a 2-digit year prefix and a sequence number. */
const buildEnrollmentId = (yearPrefix, seq) =>
  `${yearPrefix}-${String(seq).padStart(ENROLLMENT_SEQ_WIDTH, '0')}`;

// ── Service functions ────────────────────────────────────────────────────────

/**
 * Create a student User + Student profile in a single transaction.
 *
 * @param {{ name, email, password, phone, enrollmentId, dateOfBirth, address }} data
 * @param {string} schoolId  Injected from req.school._id — never from req.body
 * @returns {Promise<{ user, student }>}
 */
/** Insert the User + Student pair in one transaction. Throws on conflict. */
const insertStudentTx = async ({
  name, email, tempPassword, phone, schoolId, enrollmentId, dateOfBirth, address, classId,
}) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Mongoose requires array form when passing a session to create()
    const [user] = await User.create(
      [{ name, email, password: tempPassword, role: 'student', phone: phone || null, schoolId, mustChangePassword: true }],
      { session }
    );
    const [student] = await Student.create(
      [{
        schoolId,
        userId: user._id,
        enrollmentId,
        dateOfBirth,
        address: address || null,
        classId,
      }],
      { session }
    );

    await session.commitTransaction();
    return { user, student };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

const createStudent = async (data, schoolId) => {
  const { name, email, phone, enrollmentId, dateOfBirth, address, password, classId } = data;

  // An enrollmentId is optional: the admin UI never sends one and lets the
  // server allocate it. It is still accepted so a school migrating in can keep
  // the numbers already printed on its students' ID cards and records.
  const suppliedId = (enrollmentId || '').trim().toUpperCase();

  // Reject a bad/foreign class before opening the transaction.
  const resolvedClassId = await resolveClassId(classId, schoolId);

  // Pre-flight duplicate checks (cheaper than letting the DB throw 11000)
  const [dupEnrollment, dupEmail] = await Promise.all([
    suppliedId ? Student.findOne({ schoolId, enrollmentId: suppliedId }) : null,
    User.findOne({ email }),
  ]);

  if (dupEnrollment) {
    throw new ApiError(409, `Enrollment ID '${suppliedId}' is already in use`);
  }
  if (dupEmail) {
    throw emailConflictError(dupEmail, { schoolId, label: 'student' });
  }

  // Use admin-provided password if given; otherwise generate a secure temp password
  const tempPassword = password || crypto.randomBytes(6).toString('hex'); // 12 hex chars

  const attempts = suppliedId ? 1 : MAX_ENROLLMENT_ATTEMPTS;
  let result;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const idForAttempt = suppliedId || (await getNextEnrollmentId(schoolId));

    try {
      result = await insertStudentTx({
        name,
        email,
        tempPassword,
        phone,
        schoolId,
        enrollmentId: idForAttempt,
        dateOfBirth,
        address,
        classId: resolvedClassId,
      });
      break;
    } catch (err) {
      if (err.code !== MONGO_DUPLICATE_KEY) throw err;

      const keyPattern = err.keyPattern || {};
      if (!('enrollmentId' in keyPattern)) {
        // Lost a race on the unique email index — same conflict, same message.
        throw emailConflictError(await User.findOne({ email }), { schoolId, label: 'student' });
      }
      if (suppliedId) {
        throw new ApiError(409, `Enrollment ID '${suppliedId}' is already in use`);
      }
      if (attempt === attempts) {
        throw new ApiError(409, 'Could not allocate an enrollment ID. Please try again.');
      }
      // else: a concurrent create took our number — recompute and retry
    }
  }

  // Refresh the school's cached `activeStudentCount` AFTER commit.
  // Auto-flips the subscription between `trial` ↔ `trial_limit_reached`
  // if this create crossed the cap.
  studentCountService.updateCachedCount(schoolId).catch((err) => {
    logger.error(
      `[student.service] failed to update activeStudentCount for ${schoolId}: ${err.message}`
    );
  });

  // Fire-and-forget email — never block the response
  setImmediate(() => {
    const emailService = require('./email.service');
    emailService.sendTempPassword(email, name, tempPassword).catch((err) => {
      logger.error(`Failed to send temp password email to ${email}: ${err.message}`);
    });
  });

  return result;
};

/**
 * Suggest the next unused enrollment ID for a school, e.g. "26-000001".
 *
 * The sequence is derived from the highest ID already issued this year — NOT
 * from the student head-count. Soft-deleted students keep their enrollmentId
 * and still occupy the { schoolId, enrollmentId } unique index, so a number
 * belonging to a deleted student must never be handed out again.
 *
 * @param {string} schoolId
 * @returns {Promise<string>}
 */
const getNextEnrollmentId = async (schoolId) => {
  const yearPrefix = String(new Date().getFullYear()).slice(-2);

  // No isDeleted filter — retired numbers still count as taken.
  // Widths are fixed and zero-padded, so a lexicographic sort is a numeric one.
  const latest = await Student.findOne(
    {
      schoolId,
      enrollmentId: new RegExp(`^${yearPrefix}-\\d{${ENROLLMENT_SEQ_WIDTH}}$`),
    },
    'enrollmentId'
  )
    .sort({ enrollmentId: -1 })
    .lean();

  const lastSeq = latest ? Number(latest.enrollmentId.slice(-ENROLLMENT_SEQ_WIDTH)) : 0;
  return buildEnrollmentId(yearPrefix, lastSeq + 1);
};

/**
 * List students with optional search and pagination, scoped to a school.
 *
 * @param {{ page?: number, limit?: number, search?: string, classId?: string }} options
 *   classId accepts a Class _id, or the literal 'unassigned' for students with
 *   no class. An unrecognised value is ignored rather than throwing.
 * @param {string} schoolId
 * @returns {Promise<{ students, total, page, limit, totalPages }>}
 */
const listStudents = async (
  { page = 1, limit = 20, search = '', classId = '' } = {},
  schoolId
) => {
  const skip = (Number(page) - 1) * Number(limit);
  const filter = { schoolId, isDeleted: false };

  // Class filter must run server-side: the list is paginated, so filtering on
  // the client would only ever narrow the current page.
  if (classId === 'unassigned') {
    filter.classId = null;
  } else if (classId && mongoose.isValidObjectId(classId)) {
    filter.classId = new mongoose.Types.ObjectId(classId);
  }

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

  const { name, phone, enrollmentId, dateOfBirth, address, classId } = data;

  const userUpdate = {};
  if (name !== undefined) userUpdate.name = name;
  if (phone !== undefined) userUpdate.phone = phone;

  const studentUpdate = {};
  if (enrollmentId !== undefined) {
    const normalized = enrollmentId.toUpperCase();
    const conflict = await Student.findOne({ schoolId, enrollmentId: normalized, _id: { $ne: id } });
    if (conflict) throw new ApiError(409, `Enrollment ID '${normalized}' is already in use`);
    studentUpdate.enrollmentId = normalized;
  }
  if (dateOfBirth !== undefined) studentUpdate.dateOfBirth = dateOfBirth;
  if (address !== undefined) studentUpdate.address = address;
  // An empty classId is a deliberate un-assignment, not a no-op.
  if (classId !== undefined) studentUpdate.classId = await resolveClassId(classId, schoolId);

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

  // Recalculate the cached count. Deletion may free up a trial slot and
  // flip the subscription back from trial_limit_reached → trial.
  studentCountService.updateCachedCount(schoolId).catch((err) => {
    logger.error(
      `[student.service] failed to update activeStudentCount after delete for ${schoolId}: ${err.message}`
    );
  });
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
 * Get a student's coursework, grouped by subject.
 *
 * Each entry carries the detail that makes it identifiable — title, date,
 * teacher, type — plus the class average. Delegates to assessment.service so
 * students and parents read through exactly one implementation.
 *
 * @param {string} userId
 * @param {string} schoolId
 * @param {{ academicYear?: string }} filters
 * @returns {Promise<{ subjects, overallPercentage, totalCount }>}
 */
const getStudentCoursework = async (userId, schoolId, filters = {}) => {
  const student = await Student.findOne({ userId, schoolId, isDeleted: false }, '_id');
  if (!student) {
    throw new ApiError(404, 'Student profile not found');
  }
  return assessmentService.getStudentCoursework(schoolId, student._id, filters);
};

const getStudentAnnouncements = async (schoolId) => {
  return Announcement.find({
    schoolId,
    isDeleted: false,
    targetRole: { $in: ['all', 'student'] },
    ...notExpiredFilter(),
  })
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
  getStudentCoursework,
  getStudentAnnouncements,
};
