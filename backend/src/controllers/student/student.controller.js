const ApiResponse = require('../../utils/ApiResponse');
const {
  getStudentProfile,
  getStudentTimetable,
  getStudentAttendance,
  getStudentCoursework,
  getStudentAnnouncements,
} = require('../../services/student.service');

// ── GET /api/v1/student/profile ───────────────────────────────────────────────

/**
 * Return the authenticated student's own profile.
 * All data is scoped to req.user._id — no caller-supplied IDs.
 */
const getProfile = async (req, res, next) => {
  try {
    const student = await getStudentProfile(req.user._id, req.school._id);
    res.json(new ApiResponse(200, { student }, 'Profile retrieved successfully'));
  } catch (err) {
    next(err);
  }
};

// ── GET /api/v1/student/timetable ─────────────────────────────────────────────

/**
 * Return the timetable for the student's assigned class.
 * Returns empty array when no class is assigned yet.
 */
const getTimetable = async (req, res, next) => {
  try {
    const periods = await getStudentTimetable(req.user._id, req.school._id);
    res.json(new ApiResponse(200, { periods }, 'Timetable retrieved successfully'));
  } catch (err) {
    next(err);
  }
};

// ── GET /api/v1/student/attendance ────────────────────────────────────────────

/**
 * Return attendance summary + records for the authenticated student.
 * Optional query param: ?month=YYYY-MM  — filters to that calendar month.
 */
const getAttendance = async (req, res, next) => {
  try {
    const { month } = req.query;
    const data = await getStudentAttendance(req.user._id, month, req.school._id);
    res.json(new ApiResponse(200, data, 'Attendance retrieved successfully'));
  } catch (err) {
    next(err);
  }
};

// ── GET /api/v1/student/coursework ────────────────────────────────────────────

/**
 * Return coursework grouped by subject for the authenticated student.
 */
const getCoursework = async (req, res, next) => {
  try {
    const data = await getStudentCoursework(req.user._id, req.school._id, {
      academicYear: req.query.academicYear,
    });
    res.json(new ApiResponse(200, data, 'Coursework retrieved successfully'));
  } catch (err) {
    next(err);
  }
};

// ── GET /api/v1/student/announcements ─────────────────────────────────────────

/**
 * Return the latest 20 active announcements.
 */
const getAnnouncements = async (req, res, next) => {
  try {
    const announcements = await getStudentAnnouncements(req.school._id);
    res.json(new ApiResponse(200, { announcements }, 'Announcements retrieved successfully'));
  } catch (err) {
    next(err);
  }
};

module.exports = { getProfile, getTimetable, getAttendance, getCoursework, getAnnouncements };
