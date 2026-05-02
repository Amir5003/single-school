const ApiError = require('../../src/utils/ApiError');
const ApiResponse = require('../../src/utils/ApiResponse');

// ── ApiError ─────────────────────────────────────────────────────────────────

describe('ApiError', () => {
  it('is an instance of Error', () => {
    const err = new ApiError(404, 'Not found');
    expect(err).toBeInstanceOf(Error);
  });

  it('sets statusCode', () => {
    const err = new ApiError(422, 'Validation failed');
    expect(err.statusCode).toBe(422);
  });

  it('sets success = false', () => {
    expect(new ApiError(500).success).toBe(false);
  });

  it('uses default message when none supplied', () => {
    const err = new ApiError(500);
    expect(err.message).toBe('Something went wrong');
  });

  it('preserves custom message', () => {
    const err = new ApiError(409, 'Duplicate email');
    expect(err.message).toBe('Duplicate email');
  });

  it('has a stack trace', () => {
    const err = new ApiError(400, 'Bad request');
    expect(err.stack).toBeDefined();
  });
});

// ── ApiResponse ───────────────────────────────────────────────────────────────

describe('ApiResponse', () => {
  it('success is true for 2xx status codes', () => {
    expect(new ApiResponse(200, {}).success).toBe(true);
    expect(new ApiResponse(201, {}).success).toBe(true);
  });

  it('success is false for 4xx/5xx status codes', () => {
    expect(new ApiResponse(400, {}).success).toBe(false);
    expect(new ApiResponse(500, {}).success).toBe(false);
  });

  it('carries the data payload', () => {
    const payload = { id: 42, name: 'Test' };
    const res = new ApiResponse(200, payload, 'OK');
    expect(res.data).toEqual(payload);
  });

  it('uses default message "Success"', () => {
    const res = new ApiResponse(200, null);
    expect(res.message).toBe('Success');
  });

  it('preserves custom message', () => {
    const res = new ApiResponse(201, {}, 'Created');
    expect(res.message).toBe('Created');
  });

  it('statusCode field is accessible', () => {
    const res = new ApiResponse(204, null);
    expect(res.statusCode).toBe(204);
  });
});
