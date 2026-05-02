const mongoose = require('mongoose');

describe('Phase 1 smoke tests', () => {
  it('MongoDB in-memory server is connected', () => {
    expect(mongoose.connection.readyState).toBe(1); // 1 = connected
  });

  it('required env vars are set', () => {
    expect(process.env.PORT).toBeDefined();
    expect(process.env.MONGO_URI).toBeDefined();
    expect(process.env.JWT_SECRET).toBeDefined();
    expect(process.env.JWT_EXPIRES_IN).toBeDefined();
  });

  it('ApiResponse wraps data correctly', () => {
    const ApiResponse = require('../../src/utils/ApiResponse');
    const res = new ApiResponse(200, { id: 1 }, 'OK');
    expect(res.success).toBe(true);
    expect(res.data).toEqual({ id: 1 });
    expect(res.message).toBe('OK');
  });

  it('ApiError is an instance of Error', () => {
    const ApiError = require('../../src/utils/ApiError');
    const err = new ApiError(404, 'Not found');
    expect(err).toBeInstanceOf(Error);
    expect(err.statusCode).toBe(404);
    expect(err.success).toBe(false);
  });

  it('logger redacts sensitive fields', () => {
    const logger = require('../../src/utils/logger');
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    logger.info({ password: 'secret123', name: 'Alice' });
    const logged = JSON.stringify(spy.mock.calls[0]);
    expect(logged).not.toContain('secret123');
    expect(logged).toContain('[REDACTED]');
    spy.mockRestore();
  });
});
