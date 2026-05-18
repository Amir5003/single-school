const ApiResponse = require('../../utils/ApiResponse');
const teacherService = require('../../services/teacher.service');

/**
 * POST /api/v1/admin/teachers
 */
const createTeacher = async (req, res, next) => {
  try {
    const { user, teacher } = await teacherService.createTeacher(req.body, req.school._id);
    res
      .status(201)
      .json(new ApiResponse(201, { user, teacher }, 'Teacher created successfully'));
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/admin/teachers
 */
const listTeachers = async (req, res, next) => {
  try {
    const teachers = await teacherService.listTeachers(req.school._id);
    res.json(new ApiResponse(200, { teachers }, 'Teachers retrieved successfully'));
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/admin/teachers/:id
 */
const getTeacher = async (req, res, next) => {
  try {
    const { teacher, assignments } = await teacherService.getTeacher(req.params.id, req.school._id);
    res.json(new ApiResponse(200, { teacher, assignments }, 'Teacher retrieved successfully'));
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/admin/teachers/:id
 */
const updateTeacher = async (req, res, next) => {
  try {
    const teacher = await teacherService.updateTeacher(req.params.id, req.body, req.school._id);
    res.json(new ApiResponse(200, { teacher }, 'Teacher updated successfully'));
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/admin/teachers/:id
 */
const deleteTeacher = async (req, res, next) => {
  try {
    await teacherService.deleteTeacher(req.params.id, req.school._id);
    res.json(new ApiResponse(200, null, 'Teacher deleted successfully'));
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/admin/teachers/:id/assign-class
 * Body: { classId, subject }
 */
const assignToClass = async (req, res, next) => {
  try {
    const assignment = await teacherService.assignToClass(
      req.params.id,
      req.body.classId,
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
  createTeacher,
  listTeachers,
  getTeacher,
  updateTeacher,
  deleteTeacher,
  assignToClass,
};
