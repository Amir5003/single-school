const authService = require('../services/auth.service');
const ApiResponse = require('../utils/ApiResponse');

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
  secure: process.env.NODE_ENV === 'production',
  // maxAge in ms: parse e.g. "7d" → 7 days
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const register = async (req, res, next) => {
  try {
    const user = await authService.register(req.body);
    return res
      .status(201)
      .json(new ApiResponse(201, { user }, 'Registration successful'));
  } catch (err) {
    return next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { user, token } = await authService.login(email, password);

    return res
      .status(200)
      .cookie('token', token, COOKIE_OPTIONS)
      .json(new ApiResponse(200, { user }, 'Login successful'));
  } catch (err) {
    return next(err);
  }
};

const logout = (_req, res) => {
  return res
    .status(200)
    .clearCookie('token', {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      secure: process.env.NODE_ENV === 'production',
    })
    .json(new ApiResponse(200, null, 'Logged out successfully'));
};

const getMe = async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user._id);
    return res
      .status(200)
      .json(new ApiResponse(200, { user }, 'User retrieved'));
  } catch (err) {
    return next(err);
  }
};

module.exports = { register, login, logout, getMe };
