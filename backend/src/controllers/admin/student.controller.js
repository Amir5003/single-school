const ApiResponse = require('../../utils/ApiResponse');
const studentService = require('../../services/student.service');

/**
 * POST /api/v1/admin/students
 * Create a new student (User + Student profile in transaction).
 */
const createStudent = async (req, res, next) => {
  try {
    const { user, student } = await studentService.createStudent(req.body, req.school._id);
    res
      .status(201)
      .json(new ApiResponse(201, { user, student }, 'Student created successfully'));
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/admin/students
 * List students with optional pagination and search.
 * Query params: page, limit, search
 */
const listStudents = async (req, res, next) => {
  try {
    const { page, limit, search } = req.query;
    const result = await studentService.listStudents({ page, limit, search }, req.school._id);
    res.json(new ApiResponse(200, result, 'Students retrieved successfully'));
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/admin/students/:id
 * Get a single student by their Student _id (populated).
 */
const getStudent = async (req, res, next) => {
  try {
    const student = await studentService.getStudent(req.params.id, req.school._id);
    res.json(new ApiResponse(200, { student }, 'Student retrieved successfully'));
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/admin/students/:id
 * Partially update a student's profile.
 */
const updateStudent = async (req, res, next) => {
  try {
    const student = await studentService.updateStudent(req.params.id, req.body, req.school._id);
    res.json(new ApiResponse(200, { student }, 'Student updated successfully'));
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/admin/students/:id
 * Soft-delete a student (sets isDeleted: true, deactivates User).
 */
const deleteStudent = async (req, res, next) => {
  try {
    await studentService.softDeleteStudent(req.params.id, req.school._id);
    res.json(new ApiResponse(200, null, 'Student deleted successfully'));
  } catch (err) {
    next(err);
  }
};

module.exports = { createStudent, listStudents, getStudent, updateStudent, deleteStudent };
