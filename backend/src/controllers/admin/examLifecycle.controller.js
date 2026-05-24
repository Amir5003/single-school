const examService = require('../../services/exam.service');
const subjectSubmissionService = require('../../services/subjectSubmission.service');
const ApiResponse = require('../../utils/ApiResponse');

const activate = async (req, res, next) => {
  try {
    const data = await examService.activateExam(req.school._id, req.params.examId);
    res.json(new ApiResponse(200, data, 'Exam activated'));
  } catch (err) {
    next(err);
  }
};

const publish = async (req, res, next) => {
  try {
    const data = await examService.publishExam(
      req.school._id,
      req.params.examId,
      req.user._id
    );
    res.json(new ApiResponse(200, data, 'Exam published'));
  } catch (err) {
    // Surface `blocking` array if present
    if (err.blocking) {
      return res
        .status(err.statusCode || 409)
        .json({ statusCode: err.statusCode || 409, success: false, message: err.message, blocking: err.blocking });
    }
    next(err);
  }
};

const revertToDraft = async (req, res, next) => {
  try {
    const exam = await examService.revertToDraft(req.school._id, req.params.examId);
    res.json(new ApiResponse(200, { exam }, 'Exam reverted to draft'));
  } catch (err) {
    next(err);
  }
};

const dashboard = async (req, res, next) => {
  try {
    const data = await subjectSubmissionService.getDashboard(
      req.school._id,
      req.params.examId
    );
    res.json(new ApiResponse(200, data, 'Dashboard retrieved'));
  } catch (err) {
    next(err);
  }
};

const reopenSubmission = async (req, res, next) => {
  try {
    const submission = await subjectSubmissionService.reopenForAdmin(
      req.school._id,
      req.params.examId,
      req.params.submissionId
    );
    res.json(new ApiResponse(200, { submission }, 'Submission re-opened'));
  } catch (err) {
    next(err);
  }
};

const reassignSubmission = async (req, res, next) => {
  try {
    const submission = await subjectSubmissionService.reassignTeacher(
      req.school._id,
      req.params.examId,
      req.params.submissionId,
      req.body.teacherId
    );
    res.json(new ApiResponse(200, { submission }, 'Submission reassigned'));
  } catch (err) {
    next(err);
  }
};

module.exports = {
  activate,
  publish,
  revertToDraft,
  dashboard,
  reopenSubmission,
  reassignSubmission,
};
