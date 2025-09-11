/**
 * Test utilities for API testing
 * Provides common functions for making authenticated requests and test setup
 */

const request = require('supertest');

// We'll import the app once we set up the test environment
let app;

/**
 * Initialize the test app
 * This should be called in test setup
 */
const initTestApp = (testApp) => {
  app = testApp;
};

/**
 * Create a test request to the specified endpoint
 * @param {string} endpoint - The API endpoint to test
 * @param {string} method - HTTP method (default: 'get')
 * @returns {Object} - Supertest request object
 */
const createTestRequest = (endpoint, method = 'get') => {
  if (!app) {
    throw new Error('Test app not initialized. Call initTestApp() first.');
  }
  
  return request(app)[method](endpoint);
};

/**
 * Add authentication header to a request
 * @param {Object} req - Supertest request object
 * @param {string} apiKey - API key to use for authentication
 * @returns {Object} - Request with authentication header
 */
const withAuth = (req, apiKey = 'test_api_key') => {
  return req.set('Authorization', `Bearer ${apiKey}`);
};

/**
 * Create an authenticated request in one call
 * @param {string} endpoint - The API endpoint to test
 * @param {string} method - HTTP method (default: 'get')
 * @param {string} apiKey - API key to use for authentication
 * @returns {Object} - Authenticated Supertest request object
 */
const createAuthenticatedRequest = (endpoint, method = 'get', apiKey = 'test_api_key') => {
  return withAuth(createTestRequest(endpoint, method), apiKey);
};

/**
 * Common test data for consistent testing
 */
const testData = {
  validApiKey: 'oriva_pk_test_valid_key',
  invalidApiKey: 'oriva_pk_test_invalid_key',
  testUserId: 'test_user_123',
  testProfileId: 'test_profile_456',
  testGroupId: 'test_group_789'
};

/**
 * Mock Supabase response for testing
 */
const mockSupabaseResponse = (data, error = null) => ({
  data,
  error
});

/**
 * Mock Oriva Core response for testing
 */
const mockOrivaCoreResponse = (data, success = true) => ({
  success,
  data
});

module.exports = {
  initTestApp,
  createTestRequest,
  withAuth,
  createAuthenticatedRequest,
  testData,
  mockSupabaseResponse,
  mockOrivaCoreResponse
};
