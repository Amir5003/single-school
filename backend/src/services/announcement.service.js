const Announcement = require('../models/Announcement.model');
const ApiError = require('../utils/ApiError');

// ── Visibility helpers ───────────────────────────────────────────────────────

/**
 * Normalise a caller-supplied `visibleUntil` into a Date or null.
 *
 * `null`, `undefined` and `''` all mean "always visible". A date-only string
 * (YYYY-MM-DD) is pushed to the end of that day so an announcement set to
 * expire "on the 6th" stays up for the whole of the 6th.
 *
 * @param {string|Date|null} value
 * @returns {Date|null}
 */
const normaliseVisibleUntil = (value) => {
  if (value === null || value === undefined || value === '') return null;

  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, 'visibleUntil must be a valid date');
  }

  // Date-only input carries no time — treat it as end of that day.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
};

/**
 * Mongo filter fragment matching announcements that have not expired.
 * Documents written before `visibleUntil` existed have no such field, and
 * `{ visibleUntil: null }` matches missing fields too — so they stay visible.
 *
 * @param {Date} [now=new Date()]
 */
const notExpiredFilter = (now = new Date()) => ({
  $or: [{ visibleUntil: null }, { visibleUntil: { $gte: now } }],
});

// ── Service functions ────────────────────────────────────────────────────────

/**
 * Create a new announcement.
 *
 * @param {string} teacherId  Teacher._id
 * @param {{ title, content, targetRole?, visibleUntil? }} data
 * @returns {Promise<Announcement>}
 */
const createAnnouncement = async (teacherId, data, schoolId) => {
  const { title, content, targetRole = 'all', visibleUntil } = data;
  return Announcement.create({
    title,
    content,
    targetRole,
    visibleUntil: normaliseVisibleUntil(visibleUntil),
    teacherId,
    schoolId,
  });
};

/**
 * List all announcements for a teacher (newest first, including soft-deleted).
 *
 * @param {string} teacherId
 * @returns {Promise<Announcement[]>}
 */
const getTeacherAnnouncements = async (teacherId, schoolId) => {
  return Announcement.find({ schoolId, teacherId })
    .sort({ publishedAt: -1 });
};

/**
 * Update a teacher's own announcement.
 * Throws 403 if the announcement belongs to another teacher.
 *
 * @param {string} id
 * @param {string} teacherId
 * @param {{ title?, content?, visibleUntil? }} data
 * @returns {Promise<Announcement>}
 */
const updateAnnouncement = async (id, teacherId, data, schoolId) => {
  const announcement = await Announcement.findOne({ _id: id, schoolId });
  if (!announcement) {
    throw new ApiError(404, 'Announcement not found');
  }
  if (announcement.teacherId.toString() !== teacherId.toString()) {
    throw new ApiError(403, 'You can only edit your own announcements');
  }

  const { title, content, visibleUntil } = data;
  if (title !== undefined) announcement.title = title;
  if (content !== undefined) announcement.content = content;
  if (visibleUntil !== undefined) {
    announcement.visibleUntil = normaliseVisibleUntil(visibleUntil);
  }

  await announcement.save();
  return announcement;
};

/**
 * Soft-delete a teacher's own announcement.
 * Throws 403 if the announcement belongs to another teacher.
 *
 * @param {string} id
 * @param {string} teacherId
 */
const softDeleteAnnouncement = async (id, teacherId, schoolId) => {
  const announcement = await Announcement.findOne({ _id: id, schoolId });
  if (!announcement) {
    throw new ApiError(404, 'Announcement not found');
  }
  if (announcement.teacherId.toString() !== teacherId.toString()) {
    throw new ApiError(403, 'You can only delete your own announcements');
  }

  announcement.isDeleted = true;
  await announcement.save();
};

/**
 * Get publicly visible announcements for a school's landing page.
 * Only returns targetRole='all' entries — never student/teacher/parent-targeted ones.
 *
 * @param {string} schoolId
 * @param {number} [limit=5]
 * @returns {Promise<Announcement[]>}
 */
const getPublicSchoolAnnouncements = async (schoolId, limit = 5) => {
  return Announcement.find({ schoolId, isDeleted: false, targetRole: 'all', ...notExpiredFilter() })
    .populate({ path: 'teacherId', populate: { path: 'userId', select: 'name' } })
    .sort({ publishedAt: -1 })
    .limit(limit);
};

/**
 * Get the latest active (non-deleted) announcements for public/student views.
 *
 * Expired announcements are hidden by default. Admins manage announcements
 * from this list, so they pass `includeExpired` to keep editing them.
 *
 * @param {number} [limit=20]
 * @param {string} [schoolId]
 * @param {{ includeExpired?: boolean }} [options]
 * @returns {Promise<Announcement[]>}
 */
const getAllActiveAnnouncements = async (limit = 20, schoolId, { includeExpired = false } = {}) => {
  const filter = { isDeleted: false, ...(includeExpired ? {} : notExpiredFilter()) };
  if (schoolId) {
    filter.schoolId = schoolId;
    filter.targetRole = { $in: ['all', 'student'] };
  }
  return Announcement.find(filter)
    .populate({
      path: 'teacherId',
      populate: { path: 'userId', select: 'name' },
    })
    .sort({ publishedAt: -1 })
    .limit(limit);
};

/**
 * Admin: update any announcement (no ownership check).
 *
 * @param {string} id
 * @param {{ title?, content?, visibleUntil? }} data
 * @returns {Promise<Announcement>}
 */
const adminUpdateAnnouncement = async (id, data, schoolId) => {
  const announcement = await Announcement.findOne({ _id: id, schoolId });
  if (!announcement) {
    throw new ApiError(404, 'Announcement not found');
  }

  const { title, content, visibleUntil } = data;
  if (title !== undefined) announcement.title = title;
  if (content !== undefined) announcement.content = content;
  if (visibleUntil !== undefined) {
    announcement.visibleUntil = normaliseVisibleUntil(visibleUntil);
  }

  await announcement.save();
  return announcement;
};

/**
 * Admin: soft-delete any announcement (no ownership check).
 *
 * @param {string} id
 */
const adminDeleteAnnouncement = async (id, schoolId) => {
  const announcement = await Announcement.findOne({ _id: id, schoolId });
  if (!announcement) {
    throw new ApiError(404, 'Announcement not found');
  }

  announcement.isDeleted = true;
  await announcement.save();
};

module.exports = {
  normaliseVisibleUntil,
  notExpiredFilter,
  createAnnouncement,
  getTeacherAnnouncements,
  updateAnnouncement,
  softDeleteAnnouncement,
  getAllActiveAnnouncements,
  getPublicSchoolAnnouncements,
  adminUpdateAnnouncement,
  adminDeleteAnnouncement,
};
