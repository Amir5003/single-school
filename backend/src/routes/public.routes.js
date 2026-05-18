const express = require('express');
const ApiResponse = require('../utils/ApiResponse');
const announcementService = require('../services/announcement.service');
const schoolService = require('../services/school.service');
const timetableService = require('../services/timetable.service');
const slugToSchool = require('../middleware/slugToSchool');

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

// ── GET /api/v1/public/schools/:slug/config ───────────────────────────────────
// Public — returns school name, slug, isActive, and branding fields.
// Used by SchoolContextLoader and SchoolLanding on the frontend.
router.get('/schools/:slug/config', slugToSchool, async (req, res, next) => {
  try {
    const config = await schoolService.getSchoolConfigBySlug(req.params.slug);
    res.json(new ApiResponse(200, { school: config }, 'School config retrieved successfully'));
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/public/schools/:slug/timetable?classId= ──────────────────────
// Public — returns timetable entries for a given class within the school.
router.get('/schools/:slug/timetable', slugToSchool, async (req, res, next) => {
  try {
    const { classId } = req.query;
    if (!classId) {
      return res.status(400).json(new ApiResponse(400, null, 'classId query param is required'));
    }
    const entries = await timetableService.listByClass(req.school._id, classId);
    res.json(new ApiResponse(200, { entries }, 'Timetable retrieved successfully'));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
