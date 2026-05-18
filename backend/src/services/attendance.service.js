const Attendance = require('../models/Attendance.model');
const ClassTeacher = require('../models/ClassTeacher.model');
const ApiError = require('../utils/ApiError');

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normalize an ISO date string (or Date) to UTC midnight (start of day).
 * e.g. "2026-04-12" → Date at 2026-04-12T00:00:00.000Z
 *
 * @param {string|Date} raw
 * @returns {Date}
 */
const toUTCMidnight = (raw) => {
  const d = new Date(raw);
  if (isNaN(d)) {
    throw new ApiError(400, 'Invalid date');
  }
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

/**
 * Verify the teacher is assigned to the given class within the school.
 * Throws ApiError(403) if not.
 *
 * @param {string} classId
 * @param {string} teacherId
 * @param {string} schoolId
 */
const assertAssigned = async (classId, teacherId, schoolId) => {
  const assigned = await ClassTeacher.exists({ schoolId, classId, teacherId });
  if (!assigned) {
    throw new ApiError(403, 'You are not assigned to this class');
  }
};

// ── Service functions ────────────────────────────────────────────────────────

/**
 * Bulk upsert attendance records for a class on a given date.
 *
 * @param {string}  classId
 * @param {string|Date} date
 * @param {{ studentId: string, status: 'Present'|'Absent'|'Leave' }[]} records
 * @param {string}  teacherId  Teacher._id
 * @returns {Promise<{ saved: number }>}
 */
const markBulkAttendance = async (classId, date, records, teacherId, schoolId) => {
  const utcDate = toUTCMidnight(date);

  // Block future dates
  const todayUTC = toUTCMidnight(new Date());
  if (utcDate > todayUTC) {
    throw new ApiError(400, 'Cannot mark attendance for a future date');
  }

  await assertAssigned(classId, teacherId, schoolId);

  if (!Array.isArray(records) || records.length === 0) {
    throw new ApiError(400, 'Attendance records array must not be empty');
  }

  const ops = records.map(({ studentId, status }) => ({
    updateOne: {
      filter: { schoolId, studentId, date: utcDate },
      update: { $set: { schoolId, studentId, classId, date: utcDate, status, markedBy: teacherId } },
      upsert: true,
    },
  }));

  const result = await Attendance.bulkWrite(ops);
  const saved = (result.upsertedCount || 0) + (result.modifiedCount || 0);
  return { saved };
};

/**
 * Fetch attendance records for a class on a date, with student names.
 *
 * @param {string}  classId
 * @param {string|Date} date
 * @param {string}  teacherId
 * @returns {Promise<Attendance[]>}
 */
const getAttendanceByClassDate = async (classId, date, teacherId, schoolId) => {
  const utcDate = toUTCMidnight(date);

  await assertAssigned(classId, teacherId, schoolId);

  return Attendance.find({ schoolId, classId, date: utcDate })
    .populate({
      path: 'studentId',
      select: 'enrollmentId',
      populate: { path: 'userId', select: 'name' },
    })
    .sort({ createdAt: 1 });
};

module.exports = { markBulkAttendance, getAttendanceByClassDate };
