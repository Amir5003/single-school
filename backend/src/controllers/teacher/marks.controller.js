const ApiResponse = require('../../utils/ApiResponse');
const teacherService = require('../../services/teacher.service');
const marksService = require('../../services/marks.service');

// ── POST /api/v1/teacher/marks ────────────────────────────────────────────────

/**
 * Insert or update a mark entry.
 *
 * Body: { studentId, classId, subject, examType?, marksObtained, maxMarks? }
 */
const saveMark = async (req, res, next) => {
  try {
    const teacher = await teacherService.getTeacherByUserId(req.user._id);
    const mark = await marksService.upsertMark(req.body, teacher._id);
    res.json(new ApiResponse(200, { mark }, 'Mark saved successfully'));
  } catch (err) {
    next(err);
  }
};

// ── GET /api/v1/teacher/marks ─────────────────────────────────────────────────

/**
 * Get all marks for a class + subject combination.
 *
 * Query: ?classId=...&subject=...
 */
const getMarks = async (req, res, next) => {
  try {
    const teacher = await teacherService.getTeacherByUserId(req.user._id);
    const { classId, subject } = req.query;
    const marks = await marksService.getMarksByClass(classId, subject, teacher._id);
    res.json(new ApiResponse(200, { marks }, 'Marks retrieved successfully'));
  } catch (err) {
    next(err);
  }
};

module.exports = { saveMark, getMarks };
