const ApiResponse = require('../../utils/ApiResponse');
const legalService = require('../../services/legal.service');

/**
 * POST /api/v1/admin/legal/ack
 *
 * Records the one-time administrator acknowledgement. Deliberately NOT wired
 * as middleware on student/teacher creation: what matters evidentially is that
 * the acknowledgement was made and recorded, not that the server refused to
 * act without it. Gating a hot path would add a failure mode and break API
 * consumers for no legal gain.
 */
const acknowledge = async (req, res, next) => {
  try {
    const data = await legalService.acknowledgeDataResponsibility(req.user._id);
    res.json(new ApiResponse(200, data, 'Acknowledgement recorded'));
  } catch (err) {
    next(err);
  }
};

module.exports = { acknowledge };
