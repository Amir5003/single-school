const School = require('../models/School.model');
const User = require('../models/User.model');
const Student = require('../models/Student.model');
const Teacher = require('../models/Teacher.model');
const Class = require('../models/Class.model');
const ApiError = require('../utils/ApiError');

/**
 * List all schools with optional filters and pagination.
 *
 * @param {{ page?: number, limit?: number, search?: string, plan?: string, isActive?: boolean }} opts
 * @returns {Promise<{ schools: School[], total: number, page: number, pages: number }>}
 */
const listSchools = async ({ page = 1, limit = 20, search, plan, isActive } = {}) => {
  const filter = {};
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { slug: { $regex: search, $options: 'i' } },
    ];
  }
  if (plan !== undefined) filter.plan = plan;
  if (isActive !== undefined) filter.isActive = isActive;

  const skip = (page - 1) * limit;
  const [schools, total] = await Promise.all([
    School.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    School.countDocuments(filter),
  ]);

  return { schools, total, page, pages: Math.ceil(total / limit) };
};

/**
 * Get a single school by its MongoDB _id.
 *
 * @param {string} id
 * @returns {Promise<School>}
 */
const getSchoolById = async (id) => {
  const school = await School.findById(id).lean();
  if (!school) throw new ApiError(404, 'School not found');
  return school;
};

/**
 * Activate a school (set isActive = true).
 *
 * @param {string} id
 * @returns {Promise<School>}
 */
const activateSchool = async (id) => {
  const school = await School.findByIdAndUpdate(
    id,
    { isActive: true },
    { new: true, runValidators: true }
  ).lean();
  if (!school) throw new ApiError(404, 'School not found');

  // Approve pending admins (first-time activation)
  await User.updateMany(
    { schoolId: school._id, role: 'school-admin', approvalStatus: 'pending' },
    { approvalStatus: 'approved', isActive: true, rejectionRemark: null }
  );
  // Re-enable approved admins that were disabled when the school was deactivated
  await User.updateMany(
    { schoolId: school._id, role: 'school-admin', approvalStatus: 'approved', isActive: false },
    { isActive: true }
  );

  return school;
};

/**
 * Deactivate a school (set isActive = false).
 *
 * @param {string} id
 * @returns {Promise<School>}
 */
const deactivateSchool = async (id) => {
  const school = await School.findByIdAndUpdate(
    id,
    { isActive: false },
    { new: true, runValidators: true }
  ).lean();
  if (!school) throw new ApiError(404, 'School not found');

  // Disable all active school-admin users so login is blocked too
  await User.updateMany(
    { schoolId: school._id, role: 'school-admin', isActive: true },
    { isActive: false }
  );

  return school;
};

/**
 * Get aggregated analytics counts per school.
 * Returns only counts — no individual student/teacher PII.
 *
 * @returns {Promise<Array<{ schoolId: string, schoolName: string, slug: string, isActive: boolean, plan: string, students: number, teachers: number, classes: number }>>}
 */
const getAnalytics = async () => {
  const [schools, studentCounts, teacherCounts, classCounts] = await Promise.all([
    School.find({}, 'name slug isActive plan').lean(),
    Student.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $group: { _id: '$schoolId', count: { $sum: 1 } } },
    ]),
    Teacher.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $group: { _id: '$schoolId', count: { $sum: 1 } } },
    ]),
    Class.aggregate([{ $group: { _id: '$schoolId', count: { $sum: 1 } } }]),
  ]);

  const countMap = (arr) =>
    arr.reduce((acc, { _id, count }) => {
      acc[_id.toString()] = count;
      return acc;
    }, {});

  const studentMap = countMap(studentCounts);
  const teacherMap = countMap(teacherCounts);
  const classMap = countMap(classCounts);

  return schools.map((s) => ({
    schoolId: s._id,
    schoolName: s.name,
    slug: s.slug,
    isActive: s.isActive,
    plan: s.plan,
    students: studentMap[s._id.toString()] || 0,
    teachers: teacherMap[s._id.toString()] || 0,
    classes: classMap[s._id.toString()] || 0,
  }));
};

/**
 * List pending school-admin registrations (school-admin users with approvalStatus = 'pending').
 *
 * @returns {Promise<Array>}
 */
const listPendingRegistrations = async () => {
  const users = await User.find(
    { role: 'school-admin', approvalStatus: 'pending' },
    '-password -refreshTokenHash'
  )
    .populate('schoolId', 'name slug createdAt')
    .sort({ createdAt: -1 })
    .lean();
  return users;
};

/**
 * Approve a pending school-admin: activate user + school.
 *
 * @param {string} userId
 * @returns {Promise<User>}
 */
const approveRegistration = async (userId) => {
  const user = await User.findOneAndUpdate(
    { _id: userId, role: 'school-admin', approvalStatus: 'pending' },
    { approvalStatus: 'approved', isActive: true, rejectionRemark: null },
    { new: true, select: '-password -refreshTokenHash' }
  ).lean();
  if (!user) throw new ApiError(404, 'Pending registration not found');

  if (user.schoolId) {
    await School.findByIdAndUpdate(user.schoolId, { isActive: true });
  }

  return user;
};

/**
 * Reject a pending school-admin with an optional remark.
 *
 * @param {string} userId
 * @param {string} [remark]
 * @returns {Promise<User>}
 */
const rejectRegistration = async (userId, remark) => {
  const user = await User.findOneAndUpdate(
    { _id: userId, role: 'school-admin', approvalStatus: 'pending' },
    { approvalStatus: 'rejected', rejectionRemark: remark || null },
    { new: true, select: '-password -refreshTokenHash' }
  ).lean();
  if (!user) throw new ApiError(404, 'Pending registration not found');
  return user;
};

// ── Subscription analytics (feature 006) ─────────────────────────────────────

const pricingService = require('./subscription/pricing.service');
const eventService = require('./subscription/event.service');

const SUB_STATUSES = ['trial', 'trial_limit_reached', 'grace_period', 'active', 'expired', 'cancelled'];

/**
 * Paginated list of every school with their subscription summary.
 *
 * @param {{ page?: number, limit?: number, status?: string }} opts
 */
const listSubscriptions = async ({ page = 1, limit = 25, status } = {}) => {
  const filter = {};
  if (status && SUB_STATUSES.includes(status)) {
    filter['subscription.status'] = status;
  }
  const skip = (page - 1) * limit;
  const [schools, total] = await Promise.all([
    School.find(filter, 'name slug isActive plan subscription createdAt')
      .sort({ 'subscription.status': 1, name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    School.countDocuments(filter),
  ]);
  return { schools, total, page, pages: Math.ceil(total / limit) };
};

/**
 * Aggregate platform-wide subscription metrics.
 */
const getSubscriptionAnalytics = async () => {
  const NOW = new Date();
  const THREE_DAYS = new Date(NOW.getTime() + 3 * 24 * 60 * 60 * 1000);

  // Counts per status
  const statusAgg = await School.aggregate([
    { $group: { _id: '$subscription.status', count: { $sum: 1 } } },
  ]);
  const totals = SUB_STATUSES.reduce((acc, s) => ({ ...acc, [s]: 0 }), {});
  let totalSchools = 0;
  for (const row of statusAgg) {
    if (row._id && SUB_STATUSES.includes(row._id)) {
      totals[row._id] = row.count;
    }
    totalSchools += row.count;
  }

  // Near-conversion: trial schools that are close to limit OR close to
  // expiry. Surface for sales follow-up.
  const nearConversion = await School.find(
    {
      'subscription.status': { $in: ['trial', 'trial_limit_reached'] },
      $or: [
        { 'subscription.activeStudentCount': { $gte: 40 } },
        { 'subscription.trialEndsAt': { $lt: THREE_DAYS } },
      ],
    },
    'name slug subscription createdAt'
  )
    .sort({ 'subscription.trialEndsAt': 1 })
    .limit(50)
    .lean();

  // Estimated MRR from active subscriptions only.
  const activeSchools = await School.find(
    { 'subscription.status': 'active' },
    'subscription.planType subscription.activeStudentCount'
  ).lean();
  const estimatedMRR = activeSchools.reduce(
    (sum, s) =>
      sum +
      pricingService.calculateMonthlyAmount({
        planType: s.subscription?.planType || 'standard',
        activeStudentCount: s.subscription?.activeStudentCount || 0,
      }),
    0
  );

  return {
    totals,
    totalSchools,
    nearConversion,
    estimatedMRR,
    currency: 'INR',
    generatedAt: NOW,
  };
};

/**
 * Audit trail for a specific school.
 */
const getSubscriptionEvents = async (schoolId, limit = 100) => {
  const school = await School.findById(schoolId, 'name slug').lean();
  if (!school) throw new ApiError(404, 'School not found');
  const events = await eventService.listForSchool(schoolId, limit);
  return { school, events };
};

module.exports = {
  listSchools,
  getSchoolById,
  activateSchool,
  deactivateSchool,
  getAnalytics,
  listPendingRegistrations,
  approveRegistration,
  rejectRegistration,
  listSubscriptions,
  getSubscriptionAnalytics,
  getSubscriptionEvents,
};
