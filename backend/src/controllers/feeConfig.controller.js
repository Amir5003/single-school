const feeService = require('../services/fee.service');
const ApiResponse = require('../utils/ApiResponse');

// ── Fee Configs ───────────────────────────────────────────────────────────────

const createFeeConfig = async (req, res, next) => {
  try {
    const config = await feeService.createFeeConfig(req.school._id, req.body);
    res.status(201).json(new ApiResponse(201, { config }, 'Fee config created'));
  } catch (err) { next(err); }
};

const listFeeConfigs = async (req, res, next) => {
  try {
    const configs = await feeService.listFeeConfigs(req.school._id);
    res.json(new ApiResponse(200, { configs }, 'Fee configs retrieved'));
  } catch (err) { next(err); }
};

const updateFeeConfig = async (req, res, next) => {
  try {
    const config = await feeService.updateFeeConfig(req.school._id, req.params.id, req.body);
    res.json(new ApiResponse(200, { config }, 'Fee config updated'));
  } catch (err) { next(err); }
};

const deleteFeeConfig = async (req, res, next) => {
  try {
    await feeService.deleteFeeConfig(req.school._id, req.params.id);
    res.json(new ApiResponse(200, {}, 'Fee config deleted'));
  } catch (err) { next(err); }
};

const generateFees = async (req, res, next) => {
  try {
    const result = await feeService.generateFeesFromConfig(req.school._id, req.params.id);
    res.json(new ApiResponse(200, result, `Generated ${result.created} fee record(s)`));
  } catch (err) { next(err); }
};

// ── Fee Records ───────────────────────────────────────────────────────────────

const listFeesDetailed = async (req, res, next) => {
  try {
    const { classId, status, studentId, configId, dueDateFrom, dueDateTo, page, limit } = req.query;
    const result = await feeService.listFeesWithDetails(req.school._id, { classId, status, studentId, configId, dueDateFrom, dueDateTo, page, limit });
    res.json(new ApiResponse(200, result, 'Fees retrieved'));
  } catch (err) { next(err); }
};

const updateFeeStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['paid', 'exempt', 'pending', 'overdue'].includes(status)) {
      return res.status(400).json(new ApiResponse(400, {}, 'Invalid status value'));
    }
    const fee = await feeService.updateFeeStatus(req.school._id, req.params.id, status);
    res.json(new ApiResponse(200, { fee }, `Fee marked as ${status}`));
  } catch (err) { next(err); }
};

module.exports = {
  createFeeConfig,
  listFeeConfigs,
  updateFeeConfig,
  deleteFeeConfig,
  generateFees,
  listFeesDetailed,
  updateFeeStatus,
};
