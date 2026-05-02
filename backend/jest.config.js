/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  // --runInBand is set in package.json scripts to run tests serially
  // (required for shared in-memory MongoDB instance)
};
