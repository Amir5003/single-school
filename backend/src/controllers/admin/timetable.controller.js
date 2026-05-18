const ApiResponse = require('../../utils/ApiResponse');
const timetableService = require('../../services/timetable.service');

/**
 * POST /api/v1/admin/timetable
 */
const createEntry = async (req, res, next) => {
  try {
    const entry = await timetableService.createEntry(req.body, req.school._id);
    res
      .status(201)
      .json(new ApiResponse(201, { entry }, 'Timetable entry created successfully'));
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/admin/timetable?classId=...
 */
const listByClass = async (req, res, next) => {
  try {
    const { classId } = req.query;
    const entries = await timetableService.listByClass(classId, req.school._id);
    res.json(new ApiResponse(200, { entries }, 'Timetable retrieved successfully'));
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/admin/timetable/:id
 */
const updateEntry = async (req, res, next) => {
  try {
    const entry = await timetableService.updateEntry(req.params.id, req.body, req.school._id);
    res.json(new ApiResponse(200, { entry }, 'Timetable entry updated successfully'));
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/admin/timetable/:id
 * Returns 204 No Content.
 */
const deleteEntry = async (req, res, next) => {
  try {
    await timetableService.deleteEntry(req.params.id, req.school._id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

module.exports = { createEntry, listByClass, updateEntry, deleteEntry };
