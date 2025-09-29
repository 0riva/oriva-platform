// This file is for test compatibility only
// Vercel uses index.ts directly, but Jest tests need this wrapper
// DO NOT REMOVE - Required for tests to work

// Only load in test environment
if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
  require('ts-node/register');
  module.exports = require('./index.ts');
} else {
  // In production, this file should not be used
  throw new Error('index.js should only be used in test environment. Use index.ts for production.');
}