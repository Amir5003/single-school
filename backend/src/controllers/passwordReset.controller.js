const passwordResetService = require('../services/passwordReset.service');
const ApiResponse = require('../utils/ApiResponse');

const forgotPassword = async (req, res, next) => {
  try {
    await passwordResetService.requestPasswordReset(req.body.email);
    // Always 200 — never reveal whether email exists
    res.json(new ApiResponse(200, null, "If that email is registered, you'll receive a reset link shortly"));
  } catch (err) {
    next(err);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    await passwordResetService.resetPassword(token, newPassword);
    res.json(new ApiResponse(200, null, 'Password reset successfully'));
  } catch (err) {
    next(err);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    await passwordResetService.changePassword(req.user._id, currentPassword, newPassword);
    res.json(new ApiResponse(200, null, 'Password changed successfully'));
  } catch (err) {
    next(err);
  }
};

module.exports = { forgotPassword, resetPassword, changePassword };
