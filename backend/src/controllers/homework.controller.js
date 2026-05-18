const homeworkService = require('../services/homework.service');
const Teacher = require('../models/Teacher.model');
const ApiResponse = require('../utils/ApiResponse');

const createHomework = async (req, res, next) => {
  try {
    const schoolId = req.school._id;
    const teacher = await Teacher.findOne({ userId: req.user._id, schoolId }).lean();
    if (!teacher) return res.status(404).json(new ApiResponse(404, null, 'Teacher profile not found'));
    const homework = await homeworkService.createHomework(
      schoolId,
      teacher._id,
      req.body,
      req.files || []
    );
    res.status(201).json(new ApiResponse(201, { homework }, 'Homework created successfully'));
  } catch (err) {
    next(err);
  }
};

const listHomework = async (req, res, next) => {
  try {
    const schoolId = req.school._id;
    const { classId, page, limit } = req.query;
    if (!classId) {
      return res.status(400).json(new ApiResponse(400, null, 'classId query param is required'));
    }
    const result = await homeworkService.listForClass(schoolId, classId, { page, limit });
    res.json(new ApiResponse(200, result, 'Homework retrieved successfully'));
  } catch (err) {
    next(err);
  }
};

const deleteHomework = async (req, res, next) => {
  try {
    const schoolId = req.school._id;
    const teacher = await Teacher.findOne({ userId: req.user._id, schoolId }).lean();
    if (!teacher) return res.status(404).json(new ApiResponse(404, null, 'Teacher profile not found'));
    await homeworkService.deleteHomework(schoolId, req.params.id, teacher._id);
    res.json(new ApiResponse(200, null, 'Homework deleted successfully'));
  } catch (err) {
    next(err);
  }
};

// Student view — returns homework for the student's own class
const getStudentHomework = async (req, res, next) => {
  try {
    const schoolId = req.school._id;
    const Student = require('../models/Student.model');
    const student = await Student.findOne({ userId: req.user._id, schoolId }).lean();
    if (!student) return res.json(new ApiResponse(200, { homework: [] }, 'No homework found'));
    const result = await homeworkService.listForClass(schoolId, student.classId, req.query);
    res.json(new ApiResponse(200, result, 'Homework retrieved successfully'));
  } catch (err) {
    next(err);
  }
};

module.exports = { createHomework, listHomework, deleteHomework, getStudentHomework };
