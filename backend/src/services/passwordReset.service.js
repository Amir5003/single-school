const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User.model');
const PasswordResetToken = require('../models/PasswordResetToken.model');
const emailService = require('./email.service');
const ApiError = require('../utils/ApiError');

const BCRYPT_ROUNDS = 12;
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Generate a SHA-256 hash of a raw token string.
 */
const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

/**
 * Initiate a password reset for the given email.
 * Always returns 200 — never reveals whether the email exists.
 */
const requestPasswordReset = async (email) => {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return; // silent — no enumeration

  // Invalidate previous tokens for this user
  await PasswordResetToken.deleteMany({ userId: user._id, used: false });

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await PasswordResetToken.create({ userId: user._id, tokenHash, expiresAt, used: false });

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

  // Fire-and-forget
  setImmediate(() => {
    emailService.sendPasswordResetLink(user.email, user.name, resetUrl);
  });
};

/**
 * Consume a raw reset token and update the user's password.
 */
const resetPassword = async (rawToken, newPassword) => {
  const tokenHash = hashToken(rawToken);

  const tokenDoc = await PasswordResetToken.findOne({
    tokenHash,
    used: false,
    expiresAt: { $gt: new Date() },
  });

  if (!tokenDoc) {
    throw new ApiError(400, 'This reset link is invalid or has expired');
  }

  const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await User.findByIdAndUpdate(tokenDoc.userId, {
    $set: { password: hashed, mustChangePassword: false },
  });

  tokenDoc.used = true;
  await tokenDoc.save();
};

/**
 * Change password for an authenticated user.
 */
const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) throw new ApiError(401, 'Current password is incorrect');

  // Use findByIdAndUpdate to bypass the pre('save') bcrypt hook — password is set as plain text
  // so Mongoose can hash it exactly once via the hook. Alternatively set directly and save without re-hash.
  // Assign plain-text password; pre('save') will hash it once.
  user.password = newPassword;
  user.mustChangePassword = false;
  await user.save({ validateBeforeSave: false });
};

module.exports = { requestPasswordReset, resetPassword, changePassword };
