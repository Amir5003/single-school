const resultService = require('../../services/result.service');
const ApiResponse = require('../../utils/ApiResponse');

const getResultsForExam = async (req, res, next) => {
  try {
    const data = await resultService.getResultsForExam(req.school._id, req.params.examId);
    res.json(new ApiResponse(200, data, 'Results retrieved'));
  } catch (err) {
    next(err);
  }
};

const upsertResults = async (req, res, next) => {
  try {
    await resultService.upsertResults(req.school._id, req.params.examId, req.body);
    res.json(new ApiResponse(200, null, 'Results saved'));
  } catch (err) {
    next(err);
  }
};

module.exports = { getResultsForExam, upsertResults };
