module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/loadEnv.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  testTimeout: 20000,
};