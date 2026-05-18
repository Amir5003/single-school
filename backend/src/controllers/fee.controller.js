const feeService = require('../services/fee.service');
const ApiResponse = require('../utils/ApiResponse');

const createFee = async (req, res, next) => {
  try {
    const schoolId = req.school._id;
    const fee = await feeService.createFee(schoolId, req.body);
    res.status(201).json(new ApiResponse(201, { fee }, 'Fee created successfully'));
  } catch (err) {
    next(err);
  }
};

const listFees = async (req, res, next) => {
  try {
    const schoolId = req.school._id;
    const { studentId, status, page, limit } = req.query;
    const result = await feeService.listFees(schoolId, { studentId, status, page, limit });
    res.json(new ApiResponse(200, result, 'Fees retrieved successfully'));
  } catch (err) {
    next(err);
  }
};

const markPaid = async (req, res, next) => {
  try {
    const schoolId = req.school._id;
    const fee = await feeService.markPaid(schoolId, req.params.id);
    res.json(new ApiResponse(200, { fee }, 'Fee marked as paid'));
  } catch (err) {
    next(err);
  }
};

// Used by student role — returns only the requesting student's fees
const getMyFees = async (req, res, next) => {
  try {
    const schoolId = req.school._id;
    // req.user._id is the User doc id; we need the Student doc for the studentId
    // The student doc's userId field links to req.user._id
    const Student = require('../models/Student.model');
    const student = await Student.findOne({ userId: req.user._id, schoolId }).lean();
    if (!student) return res.json(new ApiResponse(200, { fees: [] }, 'No fees found'));
    const fees = await feeService.listStudentFees(schoolId, student._id);
    res.json(new ApiResponse(200, { fees }, 'Fees retrieved successfully'));
  } catch (err) {
    next(err);
  }
};

module.exports = { createFee, listFees, markPaid, getMyFees };
