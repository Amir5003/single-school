const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');

// Express recognises 4-argument middleware as error handlers
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof ApiError) {
    const body = new ApiResponse(err.statusCode, null, err.message);
    // Attach machine-readable error code + auxiliary data (e.g. subscription
    // payload on 402s) so the frontend can branch deterministically.
    if (err.code) body.code = err.code;
    if (err.subscription) body.subscription = err.subscription;
    if (typeof err.shouldSchedule === 'boolean') body.shouldSchedule = err.shouldSchedule;
    if (err.changeType) body.changeType = err.changeType;
    if (err.feature) body.feature = err.feature;
    return res.status(err.statusCode).json(body);
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
