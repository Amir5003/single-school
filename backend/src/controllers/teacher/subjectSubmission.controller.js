const subjectSubmissionService = require('../../services/subjectSubmission.service');
const teacherService = require('../../services/teacher.service');
const ApiResponse = require('../../utils/ApiResponse');

const _resolveTeacherId = async (req) => {
  const teacher = await teacherService.getTeacherByUserId(
    req.user._id,
    req.school._id
  );
  return teacher._id;
};

const listMyExams = async (req, res, next) => {
  try {
    const teacherId = await _resolveTeacherId(req);
    const exams = await subjectSubmissionService.listForTeacher(
      req.school._id,
      teacherId
    );
    res.json(new ApiResponse(200, { exams }, 'Assigned exams retrieved'));
  } catch (err) {
    next(err);
  }
};

const getMySubmissions = async (req, res, next) => {
  try {
    const teacherId = await _resolveTeacherId(req);
    const submissions = await subjectSubmissionService.listMyForExam(
      req.school._id,
      teacherId,
      req.params.examId
    );
    res.json(new ApiResponse(200, { submissions }, 'Submissions retrieved'));
  } catch (err) {
    next(err);
  }
};

const getOne = async (req, res, next) => {
  try {
    const teacherId = await _resolveTeacherId(req);
    const data = await subjectSubmissionService.getForTeacher(
      req.school._id,
      req.params.id,
      teacherId
    );
    res.json(new ApiResponse(200, data, 'Submission retrieved'));
  } catch (err) {
    next(err);
  }
};

const saveDraft = async (req, res, next) => {
  try {
    const teacherId = await _resolveTeacherId(req);
    const submission = await subjectSubmissionService.saveDraft(
      req.school._id,
      req.params.id,
      teacherId,
      req.user._id,
      req.body.marks
    );
    res.json(new ApiResponse(200, { submission }, 'Draft saved'));
  } catch (err) {
    next(err);
  }
};

const submit = async (req, res, next) => {
  try {
    const teacherId = await _resolveTeacherId(req);
    const submission = await subjectSubmissionService.submit(
      req.school._id,
      req.params.id,
      teacherId,
      req.user._id
    );
    res.json(new ApiResponse(200, { submission }, 'Submission submitted'));
  } catch (err) {
    next(err);
  }
};

module.exports = { listMyExams, getMySubmissions, getOne, saveDraft, submit };
