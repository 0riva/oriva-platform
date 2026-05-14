// Jest configuration for contract tests
// Task: T017-T034 support

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts', '**/*.test.js'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: ['api/**/*.ts', '!api/**/*.test.ts', '!api/**/*.d.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true,
  testTimeout: 15000, // 15s timeout for API tests
  // The tests/api suite hits a shared Supabase instance. Parallel workers
  // race on that shared state, so the suite is run serially for
  // deterministic results. (Proper per-test isolation is tracked on #30.)
  maxWorkers: 1,
  globalSetup: '<rootDir>/tests/setup/global-setup.ts',
  globalTeardown: '<rootDir>/tests/setup/global-teardown.ts',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
};
