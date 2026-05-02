const ApiResponse = require('../../utils/ApiResponse');
const teacherService = require('../../services/teacher.service');
const announcementService = require('../../services/announcement.service');

// ── POST /api/v1/teacher/announcements ────────────────────────────────────────

/**
 * Create a new announcement.
 *
 * Body: { title, content }
 */
const createAnnouncement = async (req, res, next) => {
  try {
    const teacher = await teacherService.getTeacherByUserId(req.user._id);
    const announcement = await announcementService.createAnnouncement(
      teacher._id,
      req.body
    );
    res
      .status(201)
      .json(new ApiResponse(201, { announcement }, 'Announcement created successfully'));
  } catch (err) {
    next(err);
  }
};

// ── GET /api/v1/teacher/announcements ─────────────────────────────────────────

/**
 * List all own announcements (newest first).
 */
const getAnnouncements = async (req, res, next) => {
  try {
    const teacher = await teacherService.getTeacherByUserId(req.user._id);
    const announcements = await announcementService.getTeacherAnnouncements(teacher._id);
    res.json(
      new ApiResponse(200, { announcements }, 'Announcements retrieved successfully')
    );
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/v1/teacher/announcements/:id ─────────────────────────────────────

/**
 * Update own announcement.
 *
 * Body: { title?, content? }
 */
const updateAnnouncement = async (req, res, next) => {
  try {
    const teacher = await teacherService.getTeacherByUserId(req.user._id);
    const announcement = await announcementService.updateAnnouncement(
      req.params.id,
      teacher._id,
      req.body
    );
    res.json(new ApiResponse(200, { announcement }, 'Announcement updated successfully'));
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/v1/teacher/announcements/:id ──────────────────────────────────

/**
 * Soft-delete own announcement.
 */
const deleteAnnouncement = async (req, res, next) => {
  try {
    const teacher = await teacherService.getTeacherByUserId(req.user._id);
    await announcementService.softDeleteAnnouncement(req.params.id, teacher._id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createAnnouncement,
  getAnnouncements,
  updateAnnouncement,
  deleteAnnouncement,
};
