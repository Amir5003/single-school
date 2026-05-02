class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code to send to the client
   * @param {string} message    - Error description (never include credential values)
   */
  constructor(statusCode, message = 'Something went wrong') {
    super(message);
    this.statusCode = statusCode;
    this.success = false;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ApiError;
