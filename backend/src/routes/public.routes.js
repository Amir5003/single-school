const express = require('express');
const ApiResponse = require('../utils/ApiResponse');
const announcementService = require('../services/announcement.service');

const router = express.Router();

// ── GET /api/v1/public/announcements ─────────────────────────────────────────
// No authentication required — returns latest 5 non-deleted announcements.
router.get('/announcements', async (req, res, next) => {
  try {
    const announcements = await announcementService.getAllActiveAnnouncements(5);
    res.json(
      new ApiResponse(200, { announcements }, 'Announcements retrieved successfully')
    );
  } catch (err) {
    next(err);
  }
});

module.exports = router;
