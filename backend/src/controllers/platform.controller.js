const platformService = require('../services/platform.service');
const ApiResponse = require('../utils/ApiResponse');

/**
 * GET /api/v1/platform/schools
 * Query params: page, limit, search, plan, isActive
 */
const listSchools = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, plan, isActive } = req.query;
    const parsedIsActive =
      isActive === 'true' ? true : isActive === 'false' ? false : undefined;

    const result = await platformService.listSchools({
      page: parseInt(page, 10),
      limit: Math.min(parseInt(limit, 10), 100),
      search,
      plan,
      isActive: parsedIsActive,
    });

    return res.status(200).json(new ApiResponse(200, result, 'Schools retrieved'));
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/v1/platform/schools/:id
 */
const getSchool = async (req, res, next) => {
  try {
    const school = await platformService.getSchoolById(req.params.id);
    return res.status(200).json(new ApiResponse(200, { school }, 'School retrieved'));
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /api/v1/platform/schools/:id/activate
 */
const activateSchool = async (req, res, next) => {
  try {
    const school = await platformService.activateSchool(req.params.id);
    return res.status(200).json(new ApiResponse(200, { school }, 'School activated'));
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /api/v1/platform/schools/:id/deactivate
 */
const deactivateSchool = async (req, res, next) => {
  try {
    const school = await platformService.deactivateSchool(req.params.id);
    return res.status(200).json(new ApiResponse(200, { school }, 'School deactivated'));
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/v1/platform/analytics
 */
const getAnalytics = async (req, res, next) => {
  try {
    const analytics = await platformService.getAnalytics();
    return res
      .status(200)
      .json(new ApiResponse(200, { analytics }, 'Analytics retrieved'));
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/v1/platform/pending-registrations
 */
const listPendingRegistrations = async (req, res, next) => {
  try {
    const users = await platformService.listPendingRegistrations();
    return res.status(200).json(new ApiResponse(200, { users }, 'Pending registrations retrieved'));
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /api/v1/platform/registrations/:userId/approve
 */
const approveRegistration = async (req, res, next) => {
  try {
    const user = await platformService.approveRegistration(req.params.userId);
    return res.status(200).json(new ApiResponse(200, { user }, 'Registration approved'));
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /api/v1/platform/registrations/:userId/reject
 */
const rejectRegistration = async (req, res, next) => {
  try {
    const { remark } = req.body;
    const user = await platformService.rejectRegistration(req.params.userId, remark);
    return res.status(200).json(new ApiResponse(200, { user }, 'Registration rejected'));
  } catch (err) {
    return next(err);
  }
};

// ── Subscription analytics (feature 006) ─────────────────────────────────────

/**
 * GET /api/v1/platform/subscriptions?page=&limit=&status=
 */
const listSubscriptions = async (req, res, next) => {
  try {
    const { page = 1, limit = 25, status } = req.query;
    const result = await platformService.listSubscriptions({
      page: parseInt(page, 10),
      limit: Math.min(parseInt(limit, 10), 100),
      status,
    });
    return res.status(200).json(new ApiResponse(200, result, 'Subscriptions retrieved'));
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/v1/platform/subscriptions/analytics
 */
const getSubscriptionAnalytics = async (req, res, next) => {
  try {
    const analytics = await platformService.getSubscriptionAnalytics();
    return res.status(200).json(new ApiResponse(200, { analytics }, 'Subscription analytics retrieved'));
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/v1/platform/subscriptions/:schoolId/events
 */
const getSubscriptionEvents = async (req, res, next) => {
  try {
    const data = await platformService.getSubscriptionEvents(req.params.schoolId);
    return res.status(200).json(new ApiResponse(200, data, 'Subscription events retrieved'));
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  listSchools,
  getSchool,
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
