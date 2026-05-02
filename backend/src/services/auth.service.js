const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const ApiError = require('../utils/ApiError');

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
 * Authenticate credentials and return a signed JWT.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ user: User, token: string }>}
 */
const login = async (email, password) => {
  // password is excluded from toJSON output but always present on the document
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

  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  return { user, token };
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

module.exports = { register, login, getMe };
