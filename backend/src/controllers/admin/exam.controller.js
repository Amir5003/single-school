const examService = require('../../services/exam.service');
const ApiResponse = require('../../utils/ApiResponse');

const createExam = async (req, res, next) => {
  try {
    const exam = await examService.createExam(req.school._id, req.body);
    res.status(201).json(new ApiResponse(201, exam, 'Exam created successfully'));
  } catch (err) {
    next(err);
  }
};

const listExams = async (req, res, next) => {
  try {
    const exams = await examService.listExams(req.school._id, req.query);
    res.json(new ApiResponse(200, { exams }, 'Exams retrieved'));
  } catch (err) {
    next(err);
  }
};

const getExam = async (req, res, next) => {
  try {
    const exam = await examService.getExam(req.school._id, req.params.examId);
    res.json(new ApiResponse(200, exam, 'Exam retrieved'));
  } catch (err) {
    next(err);
  }
};

const updateExam = async (req, res, next) => {
  try {
    const exam = await examService.updateExam(req.school._id, req.params.examId, req.body);
    res.json(new ApiResponse(200, exam, 'Exam updated'));
  } catch (err) {
    next(err);
  }
};

const deleteExam = async (req, res, next) => {
  try {
    await examService.deleteExam(req.school._id, req.params.examId);
    res.json(new ApiResponse(200, null, 'Exam deleted'));
  } catch (err) {
    next(err);
  }
};

module.exports = { createExam, listExams, getExam, updateExam, deleteExam };
