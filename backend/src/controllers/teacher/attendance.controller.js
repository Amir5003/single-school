const ApiResponse = require('../../utils/ApiResponse');
const teacherService = require('../../services/teacher.service');
const attendanceService = require('../../services/attendance.service');

// ── GET /api/v1/teacher/classes ───────────────────────────────────────────────

/**
 * List classes assigned to the authenticated teacher.
 */
const getAssignedClasses = async (req, res, next) => {
  try {
    const teacher = await teacherService.getTeacherByUserId(req.user._id);
    const classes = await teacherService.getTeacherClasses(teacher._id);
    res.json(new ApiResponse(200, { classes }, 'Classes retrieved successfully'));
  } catch (err) {
    next(err);
  }
};

// ── GET /api/v1/teacher/classes/:classId/students ─────────────────────────────

/**
 * List all non-deleted students in a specific class.
 */
const getClassStudents = async (req, res, next) => {
  try {
    const students = await teacherService.getClassStudents(req.params.classId);
    res.json(new ApiResponse(200, { students }, 'Students retrieved successfully'));
  } catch (err) {
    next(err);
  }
};

// ── POST /api/v1/teacher/attendance ──────────────────────────────────────────

/**
 * Bulk mark / update attendance for a class on a date.
 *
 * Body: { classId, date, records: [{ studentId, status }] }
 */
const markAttendance = async (req, res, next) => {
  try {
    const teacher = await teacherService.getTeacherByUserId(req.user._id);
    const { classId, date, records } = req.body;
    const result = await attendanceService.markBulkAttendance(
      classId,
      date,
      records,
      teacher._id
    );
    res.json(new ApiResponse(200, result, 'Attendance saved successfully'));
  } catch (err) {
    next(err);
  }
};

// ── GET /api/v1/teacher/attendance ───────────────────────────────────────────

/**
 * Get attendance records for a class on a specific date.
 *
 * Query: ?classId=...&date=YYYY-MM-DD
 */
const getAttendance = async (req, res, next) => {
  try {
    const teacher = await teacherService.getTeacherByUserId(req.user._id);
    const { classId, date } = req.query;
    const records = await attendanceService.getAttendanceByClassDate(
      classId,
      date,
      teacher._id
    );
    res.json(new ApiResponse(200, { records }, 'Attendance retrieved successfully'));
  } catch (err) {
    next(err);
  }
};

module.exports = { getAssignedClasses, getClassStudents, markAttendance, getAttendance };
