const Fee = require('../models/Fee.model');
const ApiError = require('../utils/ApiError');

const PAGE_SIZE = 20;

/**
 * Create a new fee record for a student in a school.
 */
const createFee = async (schoolId, { studentId, amount, description, dueDate }) => {
  return Fee.create({ schoolId, studentId, amount, description, dueDate });
};

/**
 * List fees for a school with optional filters.
 * Filter by studentId and/or status.  Returns paginated results.
 */
const listFees = async (schoolId, { studentId, status, page = 1, limit = PAGE_SIZE } = {}) => {
  const filter = { schoolId };
  if (studentId) filter.studentId = studentId;
  if (status) filter.status = status;

  const skip = (page - 1) * limit;
  const [fees, total] = await Promise.all([
    Fee.find(filter).sort({ dueDate: -1 }).skip(skip).limit(Number(limit)).lean(),
    Fee.countDocuments(filter),
  ]);

  return { fees, total, page: Number(page), pages: Math.ceil(total / limit) };
};

/**
 * List fees for a specific student in a school (student self-view).
 * Enforces that the fee belongs to the requesting student.
 */
const listStudentFees = async (schoolId, studentId) => {
  const fees = await Fee.find({ schoolId, studentId }).sort({ dueDate: -1 }).lean();
  return fees;
};

/**
 * Transition a fee to 'paid'.  Only pending or overdue fees can be paid.
 */
const markPaid = async (schoolId, feeId) => {
  const fee = await Fee.findOneAndUpdate(
    { _id: feeId, schoolId, status: { $in: ['pending', 'overdue'] } },
    { $set: { status: 'paid', paidAt: new Date() } },
    { new: true }
  );
  if (!fee) throw new ApiError(404, 'Fee not found or already paid');
  return fee;
};

/**
 * Bulk-transition overdue fees for a school.
 * Sets status = 'overdue' where status = 'pending' and dueDate < now.
 * Called by the daily cron job.
 *
 * @param {string} schoolId
 * @returns {number} count of updated records
 */
const transitionOverdue = async (schoolId) => {
  const result = await Fee.updateMany(
    { schoolId, status: 'pending', dueDate: { $lt: new Date() } },
    { $set: { status: 'overdue' } }
  );
  return result.modifiedCount;
};

module.exports = { createFee, listFees, listStudentFees, markPaid, transitionOverdue };
