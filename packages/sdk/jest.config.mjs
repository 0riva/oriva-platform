/**
 * Jest config for @oriva/sdk — self-contained ESM ts-jest setup, mirroring
 * packages/cli. Internal imports use `./foo.js` (NodeNext); the mapper strips
 * the suffix so ts-jest resolves the `.ts` source.
 */
/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true, tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  testMatch: ['<rootDir>/__tests__/**/*.test.ts'],
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
};
