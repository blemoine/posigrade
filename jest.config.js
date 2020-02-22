module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  globalSetup: "<rootDir>/test/postgres-up.ts",
  globalTeardown: "<rootDir>/test/postgres-down.ts",
};