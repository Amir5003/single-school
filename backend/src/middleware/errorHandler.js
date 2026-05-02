const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');

// Express recognises 4-argument middleware as error handlers
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof ApiError) {
    return res
      .status(err.statusCode)
      .json(new ApiResponse(err.statusCode, null, err.message));
  }

  // Mongoose validation errors (min/max, enum, required, pattern)
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      msg: e.message,
    }));
    return res.status(422).json({ success: false, errors });
  }

  // Unexpected errors — never leak stack traces to the client
  logger.error('Unhandled error:', err.message);

  return res
    .status(500)
    .json(new ApiResponse(500, null, 'Internal Server Error'));
};

module.exports = errorHandler;
