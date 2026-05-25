const authService = require('../services/auth.service');
const ApiResponse = require('../utils/ApiResponse');

const IS_PROD = process.env.NODE_ENV === 'production';

const ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: IS_PROD ? 'none' : 'strict',
  secure: IS_PROD,
  maxAge: 15 * 60 * 1000, // 15 minutes
};

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: IS_PROD ? 'none' : 'strict',
  secure: IS_PROD,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

const CLEAR_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: IS_PROD ? 'none' : 'strict',
  secure: IS_PROD,
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
    const { user, accessToken, refreshToken } = await authService.login(email, password);

    return res
      .status(200)
      .cookie('token', accessToken, ACCESS_COOKIE_OPTIONS)
      .cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS)
      .json(new ApiResponse(200, { user, accessToken, refreshToken }, 'Login successful'));
  } catch (err) {
    return next(err);
  }
};

const refresh = async (req, res, next) => {
  try {
    const refreshToken = req.body?.refreshToken || req.cookies?.refreshToken;
    const { accessToken } = await authService.refreshAccessToken(refreshToken);

    return res
      .status(200)
      .cookie('token', accessToken, ACCESS_COOKIE_OPTIONS)
      .json(new ApiResponse(200, { accessToken }, 'Token refreshed'));
  } catch (err) {
    return next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    // Clear refresh token hash if user is authenticated
    if (req.user?._id) {
      await authService.logout(req.user._id);
    }
    return res
      .status(200)
      .clearCookie('token', CLEAR_COOKIE_OPTIONS)
      .clearCookie('refreshToken', CLEAR_COOKIE_OPTIONS)
      .json(new ApiResponse(200, null, 'Logged out successfully'));
  } catch (err) {
    return next(err);
  }
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

module.exports = { register, login, refresh, logout, getMe };
