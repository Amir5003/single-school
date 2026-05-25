const Announcement = require('../models/Announcement.model');
const ApiError = require('../utils/ApiError');

// ── Service functions ────────────────────────────────────────────────────────

/**
 * Create a new announcement.
 *
 * @param {string} teacherId  Teacher._id
 * @param {{ title, content }} data
 * @returns {Promise<Announcement>}
 */
const createAnnouncement = async (teacherId, data, schoolId) => {
  const { title, content, targetRole = 'all' } = data;
  return Announcement.create({ title, content, targetRole, teacherId, schoolId });
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
 * @param {{ title?, content? }} data
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

  const { title, content } = data;
  if (title !== undefined) announcement.title = title;
  if (content !== undefined) announcement.content = content;

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
  return Announcement.find({ schoolId, isDeleted: false, targetRole: 'all' })
    .populate({ path: 'teacherId', populate: { path: 'userId', select: 'name' } })
    .sort({ publishedAt: -1 })
    .limit(limit);
};

/**
 * Get the latest active (non-deleted) announcements for public/student views.
 *
 * @param {number} [limit=20]
 * @returns {Promise<Announcement[]>}
 */
const getAllActiveAnnouncements = async (limit = 20, schoolId) => {
  const filter = { isDeleted: false };
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
 * @param {{ title?, content? }} data
 * @returns {Promise<Announcement>}
 */
const adminUpdateAnnouncement = async (id, data, schoolId) => {
  const announcement = await Announcement.findOne({ _id: id, schoolId });
  if (!announcement) {
    throw new ApiError(404, 'Announcement not found');
  }

  const { title, content } = data;
  if (title !== undefined) announcement.title = title;
  if (content !== undefined) announcement.content = content;

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
  createAnnouncement,
  getTeacherAnnouncements,
  updateAnnouncement,
  softDeleteAnnouncement,
  getAllActiveAnnouncements,
  getPublicSchoolAnnouncements,
  adminUpdateAnnouncement,
  adminDeleteAnnouncement,
};
