const Fee = require('../models/Fee.model');
const FeeConfig = require('../models/FeeConfig.model');
const Student = require('../models/Student.model');
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

module.exports = { createFee, listFees, listStudentFees, markPaid, transitionOverdue,
  // Fee Config
  createFeeConfig, listFeeConfigs, updateFeeConfig, deleteFeeConfig, generateFeesFromConfig,
  // Flexible status update
  updateFeeStatus, listFeesWithDetails,
};

// ─────────────────────────────────────────────────────────────────────────────
// Fee Config methods
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a class-level fee configuration.
 */
async function createFeeConfig(schoolId, { classId, label, amount, dueDate, description }) {
  return FeeConfig.create({ schoolId, classId, label, amount, dueDate, description });
}

/**
 * List all fee configs for a school, with class info populated.
 */
async function listFeeConfigs(schoolId) {
  return FeeConfig.find({ schoolId })
    .populate('classId', 'name section grade')
    .sort({ createdAt: -1 })
    .lean();
}

/**
 * Update a fee config (partial update).
 */
async function updateFeeConfig(schoolId, configId, data) {
  const allowed = {};
  ['label', 'amount', 'dueDate', 'description'].forEach((k) => {
    if (data[k] !== undefined) allowed[k] = data[k];
  });
  const config = await FeeConfig.findOneAndUpdate(
    { _id: configId, schoolId },
    { $set: allowed },
    { new: true, runValidators: true }
  );
  if (!config) throw new ApiError(404, 'Fee config not found');
  return config;
}

/**
 * Delete a fee config.
 */
async function deleteFeeConfig(schoolId, configId) {
  const config = await FeeConfig.findOneAndDelete({ _id: configId, schoolId });
  if (!config) throw new ApiError(404, 'Fee config not found');
}

/**
 * Generate Fee records for every enrolled student in the config's class.
 * Students who already have a Fee linked to this configId are skipped.
 * Returns { created, skipped }.
 */
async function generateFeesFromConfig(schoolId, configId) {
  const config = await FeeConfig.findOne({ _id: configId, schoolId }).lean();
  if (!config) throw new ApiError(404, 'Fee config not found');

  const students = await Student.find({
    schoolId,
    classId: config.classId,
    isDeleted: false,
  }).lean();

  if (!students.length) return { created: 0, skipped: 0 };

  const existingIds = await Fee.distinct('studentId', { schoolId, configId });
  const existingSet = new Set(existingIds.map((id) => id.toString()));

  const toCreate = students
    .filter((s) => !existingSet.has(s._id.toString()))
    .map((s) => ({
      schoolId,
      studentId: s._id,
      configId: config._id,
      amount: config.amount,
      description: config.label + (config.description ? ` — ${config.description}` : ''),
      dueDate: config.dueDate,
      status: 'pending',
    }));

  if (toCreate.length) await Fee.insertMany(toCreate);
  return { created: toCreate.length, skipped: students.length - toCreate.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// Flexible status update (paid / exempt / pending)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update a fee's status to 'paid', 'exempt', or back to 'pending'.
 */
async function updateFeeStatus(schoolId, feeId, status) {
  const update = { status };
  if (status === 'paid') update.paidAt = new Date();
  else update.paidAt = null;

  const fee = await Fee.findOneAndUpdate(
    { _id: feeId, schoolId },
    { $set: update },
    { new: true }
  );
  if (!fee) throw new ApiError(404, 'Fee not found');
  return fee;
}

/**
 * List fees for the admin overview — with student name + roll populated.
 * Optional classId filter resolves to studentId $in query for efficiency.
 */
async function listFeesWithDetails(schoolId, { classId, status, studentId, configId, dueDateFrom, dueDateTo, page = 1, limit = 30 } = {}) {
  const filter = { schoolId };
  if (status) filter.status = status;
  if (configId) filter.configId = configId;

  if (dueDateFrom || dueDateTo) {
    filter.dueDate = {};
    if (dueDateFrom) filter.dueDate.$gte = new Date(dueDateFrom);
    if (dueDateTo) filter.dueDate.$lte = new Date(dueDateTo);
  }

  if (studentId) {
    filter.studentId = studentId;
  } else if (classId) {
    const ids = await Student.distinct('_id', { schoolId, classId, isDeleted: false });
    filter.studentId = { $in: ids };
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [fees, total] = await Promise.all([
    Fee.find(filter)
      .populate({
        path: 'studentId',
        select: 'enrollmentId classId userId',
        populate: [
          { path: 'userId', select: 'name' },
          { path: 'classId', select: 'name section' },
        ],
      })
      .populate('configId', 'label')
      .sort({ dueDate: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Fee.countDocuments(filter),
  ]);

  return { fees, total, page: Number(page), pages: Math.ceil(total / Number(limit)) };
}
