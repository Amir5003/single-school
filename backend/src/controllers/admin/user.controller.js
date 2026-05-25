const userService = require('../../services/user.service');
const ApiResponse = require('../../utils/ApiResponse');

const listPendingUsers = async (req, res, next) => {
  try {
    const users = await userService.getPendingUsers(req.user.schoolId);
    return res
      .status(200)
      .json(new ApiResponse(200, { users }, 'Pending users retrieved'));
  } catch (err) {
    return next(err);
  }
};

const approveUser = async (req, res, next) => {
  try {
    const user = await userService.approveUser(req.params.id, req.user.schoolId);
    return res
      .status(200)
      .json(new ApiResponse(200, { user }, 'User approved'));
  } catch (err) {
    return next(err);
  }
};

const rejectUser = async (req, res, next) => {
  try {
    const user = await userService.rejectUser(req.params.id, req.user.schoolId);
    return res
      .status(200)
      .json(new ApiResponse(200, { user }, 'User rejected'));
  } catch (err) {
    return next(err);
  }
};

module.exports = { listPendingUsers, approveUser, rejectUser };
