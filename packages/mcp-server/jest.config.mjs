/**
 * Jest config for @oriva/mcp-server.
 *
 * Self-contained — does NOT inherit from the repo root jest config (which
 * targets the CommonJS api/ Express app). This package is ESM-only, uses
 * ts-jest's ESM preset, and rewrites `.js` import suffixes to source `.ts`
 * files at test time.
 *
 * Globalsetup runs scripts/copy-spec.mjs so src/spec.json is always present
 * before any test exercises the projector.
 */
/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    // Internal imports use `./foo.js` (NodeNext requirement) — strip the .js
    // so ts-jest resolves the .ts source file.
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true, tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  testMatch: ['<rootDir>/__tests__/**/*.test.ts'],
  globalSetup: '<rootDir>/scripts/jest-global-setup.mjs',
  // Don't try to walk into the workspace root's node_modules during resolution.
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
};
