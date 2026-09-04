const ApiResponse = require('../../utils/ApiResponse');
const teacherService = require('../../services/teacher.service');
const assessmentService = require('../../services/assessment.service');

const resolveTeacher = (req) =>
  teacherService.getTeacherByUserId(req.user._id, req.school._id);

/** POST /api/v1/teacher/assessments */
const create = async (req, res, next) => {
  try {
    const teacher = await resolveTeacher(req);
    const assessment = await assessmentService.createAssessment(
      req.school._id,
      teacher._id,
      req.body
    );
    res.status(201).json(new ApiResponse(201, { assessment }, 'Assessment created'));
  } catch (err) {
    next(err);
  }
};

/** GET /api/v1/teacher/assessments?classId=&subject= */
const list = async (req, res, next) => {
  try {
    const teacher = await resolveTeacher(req);
    const assessments = await assessmentService.listAssessmentsForTeacher(
      req.school._id,
      teacher._id,
      { classId: req.query.classId, subject: req.query.subject }
    );
    res.json(new ApiResponse(200, { assessments }, 'Assessments retrieved'));
  } catch (err) {
    next(err);
  }
};

/** GET /api/v1/teacher/assessments/:id */
const getOne = async (req, res, next) => {
  try {
    const teacher = await resolveTeacher(req);
    const data = await assessmentService.getAssessmentWithScores(
      req.school._id,
      req.params.id,
      teacher._id
    );
    res.json(new ApiResponse(200, data, 'Assessment retrieved'));
  } catch (err) {
    next(err);
  }
};

/** PUT /api/v1/teacher/assessments/:id */
const update = async (req, res, next) => {
  try {
    const teacher = await resolveTeacher(req);
    const assessment = await assessmentService.updateAssessment(
      req.school._id,
      req.params.id,
      teacher._id,
      req.body
    );
    res.json(new ApiResponse(200, { assessment }, 'Assessment updated'));
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/v1/teacher/assessments/:id */
const remove = async (req, res, next) => {
  try {
    const teacher = await resolveTeacher(req);
    await assessmentService.deleteAssessment(req.school._id, req.params.id, teacher._id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

/** PUT /api/v1/teacher/assessments/:id/scores */
const saveScores = async (req, res, next) => {
  try {
    const teacher = await resolveTeacher(req);
    const data = await assessmentService.saveScores(
      req.school._id,
      req.params.id,
      teacher._id,
      req.body.scores ?? []
    );
    res.json(new ApiResponse(200, data, 'Scores saved'));
  } catch (err) {
    next(err);
  }
};

module.exports = { create, list, getOne, update, remove, saveScores };
