const ApiResponse = require('../../utils/ApiResponse');
const announcementService = require('../../services/announcement.service');

// ── GET /api/v1/admin/announcements ─────────────────────────────────────────

/**
 * List all announcements (including soft-deleted is left to callers via service).
 * Returns only non-deleted, newest first.
 */
const listAnnouncements = async (req, res, next) => {
  try {
    // Admins manage announcements from this list, so expired ones stay visible
    // here — they are only hidden from student/parent and public views.
    const announcements = await announcementService.getAllActiveAnnouncements(
      200,
      req.school._id,
      { includeExpired: true }
    );
    res.json(
      new ApiResponse(200, { announcements }, 'Announcements retrieved successfully')
    );
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/v1/admin/announcements/:id ──────────────────────────────────────

/**
 * Admin can edit any announcement (no ownership check).
 * Body: { title?, content? }
 */
const updateAnnouncement = async (req, res, next) => {
  try {
    const announcement = await announcementService.adminUpdateAnnouncement(
      req.params.id,
      req.body,
      req.school._id
    );
    res.json(
      new ApiResponse(200, { announcement }, 'Announcement updated successfully')
    );
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/v1/admin/announcements/:id ───────────────────────────────────

/**
 * Admin can soft-delete any announcement (no ownership check).
 */
const deleteAnnouncement = async (req, res, next) => {
  try {
    await announcementService.adminDeleteAnnouncement(req.params.id, req.school._id);
    res.json(new ApiResponse(200, null, 'Announcement deleted successfully'));
  } catch (err) {
    next(err);
  }
};

module.exports = { listAnnouncements, updateAnnouncement, deleteAnnouncement };
