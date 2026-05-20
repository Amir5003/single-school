const Exam = require('../models/Exam.model');
const Result = require('../models/Result.model');
const ApiError = require('../utils/ApiError');

/**
 * Create a new exam for the school.
 */
const createExam = async (schoolId, data) => {
  const exam = await Exam.create({ ...data, schoolId });
  return exam;
};

/**
 * List exams for the school, with optional year and classId filters.
 */
const listExams = async (schoolId, filters = {}) => {
  const query = { schoolId, isDeleted: false };
  if (filters.year) query.year = Number(filters.year);
  if (filters.classId) query.classId = filters.classId;
  const exams = await Exam.find(query).populate('classId', 'name grade section').sort({ year: -1, term: 1 });
  return exams;
};

/**
 * Get a single exam by id within the school.
 */
const getExam = async (schoolId, examId) => {
  const exam = await Exam.findOne({ _id: examId, schoolId, isDeleted: false }).populate('classId', 'name grade section');
  if (!exam) throw new ApiError(404, 'Exam not found');
  return exam;
};

/**
 * Update exam fields. Rejects term/year/classId changes if results already exist.
 */
const updateExam = async (schoolId, examId, data) => {
  const exam = await Exam.findOne({ _id: examId, schoolId, isDeleted: false });
  if (!exam) throw new ApiError(404, 'Exam not found');

  const protectedFields = ['year', 'term', 'classId', 'subjects'];
  const hasProtected = protectedFields.some((f) => data[f] !== undefined);
  if (hasProtected) {
    const resultCount = await Result.countDocuments({ examId, schoolId });
    if (resultCount > 0) {
      throw new ApiError(409, 'Cannot modify exam structure after results have been entered');
    }
  }

  Object.assign(exam, data);
  await exam.save();
  return exam;
};

/**
 * Soft-delete an exam. Rejects if results exist.
 */
const deleteExam = async (schoolId, examId) => {
  const exam = await Exam.findOne({ _id: examId, schoolId, isDeleted: false });
  if (!exam) throw new ApiError(404, 'Exam not found');

  const resultCount = await Result.countDocuments({ examId, schoolId });
  if (resultCount > 0) {
    throw new ApiError(409, 'Cannot delete an exam that already has results');
  }

  exam.isDeleted = true;
  await exam.save();
};

/**
 * Get distinct years with exams for this school.
 */
const getDistinctYears = async (schoolId) => {
  const years = await Exam.distinct('year', { schoolId, isDeleted: false });
  return years.sort((a, b) => b - a);
};

/**
 * Get exams for a specific student filtered by year.
 * Resolves the student's classId first, then returns exams for that class.
 */
const getExamsForStudent = async (schoolId, studentId, year) => {
  const Student = require('../models/Student.model');
  const student = await Student.findOne({ _id: studentId, schoolId }).lean();
  if (!student) throw new ApiError(404, 'Student not found');

  const query = { schoolId, classId: student.classId, isDeleted: false };
  if (year) query.year = Number(year);

  const exams = await Exam.find(query).sort({ year: -1, term: 1 });
  return exams;
};

module.exports = { createExam, listExams, getExam, updateExam, deleteExam, getDistinctYears, getExamsForStudent };
