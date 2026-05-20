const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const ApiError = require('../utils/ApiError');

const BCRYPT_ROUNDS = 12;

// ── Token helpers ────────────────────────────────────────────────────────────

const signAccessToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role, schoolId: user.schoolId || null },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

const signRefreshToken = (user) =>
  jwt.sign(
    { id: user._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d' }
  );

// ── Service functions ────────────────────────────────────────────────────────

/**
 * Register a new user.
 * @param {{ name, email, password, role, phone }} data
 * @returns {Promise<User>} The created user (password excluded via toJSON)
 */
const register = async (data) => {
  const existing = await User.findOne({ email: data.email });
  if (existing) {
    throw new ApiError(409, 'An account with this email already exists');
  }

  const user = await User.create({
    ...data,
    approvalStatus: 'pending',
    isActive: false,
  });
  return user;
};

/**
 * Authenticate credentials and return signed access + refresh tokens.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ user: User, accessToken: string, refreshToken: string }>}
 */
const login = async (email, password) => {
  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  if (user.approvalStatus === 'pending') {
    throw new ApiError(403, 'Account pending admin approval');
  }

  if (user.approvalStatus === 'rejected') {
    throw new ApiError(403, 'Account has been rejected by admin');
  }

  if (!user.isActive) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  // Store bcrypt hash of refresh token — never store plain token
  user.refreshTokenHash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
  await user.save();

  // Populate school so the frontend can obtain the slug for URL routing
  await user.populate('schoolId', 'slug name');

  // mustChangePassword is included via toJSON (field exists on model now)
  return { user, accessToken, refreshToken };
};

/**
 * Issue a new access token from a valid refresh token.
 * @param {string} refreshToken  Raw refresh token from cookie
 * @returns {Promise<{ accessToken: string }>}
 */
const refreshAccessToken = async (refreshToken) => {
  if (!refreshToken) {
    throw new ApiError(401, 'Refresh token required');
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }

  const user = await User.findById(decoded.id);
  if (!user || !user.refreshTokenHash) {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }

  const isValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
  if (!isValid) {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }

  const accessToken = signAccessToken(user);
  return { accessToken };
};

/**
 * Log out by clearing the stored refresh token hash.
 * @param {string} userId
 */
const logout = async (userId) => {
  await User.findByIdAndUpdate(userId, { $set: { refreshTokenHash: null } });
};

/**
 * Return the current user by ID (password excluded).
 * @param {string} userId
 * @returns {Promise<User>}
 */
const getMe = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  return user;
};

module.exports = { register, login, refreshAccessToken, logout, getMe, signAccessToken, signRefreshToken };
