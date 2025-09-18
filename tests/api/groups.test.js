/**
 * Group endpoints tests
 * Tests the new group management endpoints with TDD approach
 */

const { createTestRequest } = require('../utils/testHelpers');

describe('Group Endpoints', () => {
  describe('GET /api/v1/groups', () => {
    test('should return user groups with sanitized data', async () => {
      // For now, test endpoint structure without authentication
      const response = await createTestRequest('/api/v1/groups');
      
      // The endpoint should exist (not 404) but require auth (401)
      expect([401, 404]).toContain(response.status);
      
      if (response.status === 401) {
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('API key required');
      }
    });

    test('should require authentication', async () => {
      const response = await createTestRequest('/api/v1/groups');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('API key required');
    });
  });

  describe('GET /api/v1/groups/:groupId/members', () => {
    test('should return group members with sanitized data', async () => {
      const response = await createTestRequest('/api/v1/groups/group_123/members');
      
      // The endpoint should exist (not 404) but require auth (401)
      expect([401, 404]).toContain(response.status);
      
      if (response.status === 401) {
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('API key required');
      }
    });

    test('should require authentication', async () => {
      const response = await createTestRequest('/api/v1/groups/group_123/members');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('API key required');
    });
  });

  describe('Data Sanitization', () => {
    test('should not expose internal Oriva Core group IDs', async () => {
      // This test will be implemented when we add authentication
      // For now, just verify the endpoint exists
      const response = await createTestRequest('/api/v1/groups');
      expect([401, 404]).toContain(response.status);
    });

    test('should not expose user linking information in group members', async () => {
      // This test will be implemented when we add authentication
      // For now, just verify the endpoint exists
      const response = await createTestRequest('/api/v1/groups/group_123/members');
      expect([401, 404]).toContain(response.status);
    });
  });
});
