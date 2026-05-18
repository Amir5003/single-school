const ApiResponse = require('../../utils/ApiResponse');
const classService = require('../../services/class.service');
const teacherService = require('../../services/teacher.service');

/**
 * POST /api/v1/admin/classes
 */
const createClass = async (req, res, next) => {
  try {
    const cls = await classService.createClass(req.body, req.school._id);
    res
      .status(201)
      .json(new ApiResponse(201, { class: cls }, 'Class created successfully'));
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/admin/classes
 */
const listClasses = async (req, res, next) => {
  try {
    const classes = await classService.listClasses(req.school._id);
    res.json(new ApiResponse(200, { classes }, 'Classes retrieved successfully'));
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/admin/classes/:id
 */
const getClass = async (req, res, next) => {
  try {
    const { cls, students, assignments } = await classService.getClass(req.params.id, req.school._id);
    res.json(new ApiResponse(200, { class: cls, students, assignments }, 'Class retrieved successfully'));
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/admin/classes/:id
 */
const updateClass = async (req, res, next) => {
  try {
    const cls = await classService.updateClass(req.params.id, req.body, req.school._id);
    res.json(new ApiResponse(200, { class: cls }, 'Class updated successfully'));
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/admin/classes/:id
 */
const deleteClass = async (req, res, next) => {
  try {
    await classService.deleteClass(req.params.id, req.school._id);
    res.json(new ApiResponse(200, null, 'Class deleted successfully'));
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/admin/classes/:id/assign-students
 * Body: { studentIds: string[] }
 */
const assignStudents = async (req, res, next) => {
  try {
    const result = await classService.assignStudents(req.params.id, req.body.studentIds, req.school._id);
    res.json(new ApiResponse(200, result, 'Students assigned to class successfully'));
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/admin/classes/:id/assign-teacher
 * Body: { teacherId, subject }
 */
const assignTeacher = async (req, res, next) => {
  try {
    const assignment = await teacherService.assignToClass(
      req.body.teacherId,
      req.params.id,
      req.body.subject,
      req.school._id
    );
    res
      .status(201)
      .json(new ApiResponse(201, { assignment }, 'Teacher assigned to class successfully'));
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createClass,
  listClasses,
  getClass,
  updateClass,
  deleteClass,
  assignStudents,
  assignTeacher,
};
