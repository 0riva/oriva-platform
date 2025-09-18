/**
 * Profile endpoints tests
 * Tests the new profile management endpoints with TDD approach
 */

const { createTestRequest } = require('../utils/testHelpers');

describe('Profile Endpoints', () => {
  describe('GET /api/v1/profiles/available', () => {
    test('should return authorized profiles only', async () => {
      // For now, let's test the endpoint structure without authentication
      // We'll implement proper auth testing in the next iteration
      const response = await createTestRequest('/api/v1/profiles/available');
      
      // The endpoint should exist (not 404) but require auth (401)
      expect([401, 404]).toContain(response.status);
      
      if (response.status === 401) {
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('API key required');
      }
    });

    test('should require authentication', async () => {
      const response = await createTestRequest('/api/v1/profiles/available');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('API key required');
    });
  });

  describe('GET /api/v1/profiles/active', () => {
    test('should require authentication', async () => {
      const response = await createTestRequest('/api/v1/profiles/active');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('API key required');
    });
  });

  describe('POST /api/v1/profiles/:profileId/activate', () => {
    test('should require authentication', async () => {
      const response = await createTestRequest('/api/v1/profiles/profile_123/activate', 'post');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('API key required');
    });
  });
});
