// Export the TypeScript version for test compatibility
// This allows tests to import '../api/index.js' while production uses index.ts directly
const { app } = require('./index.ts');
module.exports = app;