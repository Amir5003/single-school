class ApiResponse {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {*}      data       - Response payload
   * @param {string} message    - Human-readable message
   */
  constructor(statusCode, data, message = 'Success') {
    this.statusCode = statusCode;
    this.success = statusCode < 400;
    this.message = message;
    this.data = data;
  }
}

module.exports = ApiResponse;
