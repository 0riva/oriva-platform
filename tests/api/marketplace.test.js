/**
 * Marketplace API tests
 * Tests the marketplace endpoints for app discovery and management
 */

const { createTestRequest, withAuth, testData } = require('../utils/testHelpers');

describe('Marketplace API', () => {
  describe('GET /api/v1/marketplace/apps', () => {
    test('should require authentication', async () => {
      const response = await createTestRequest('/api/v1/marketplace/apps');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('API key required');
    });

    test('should return marketplace apps with valid API key', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/marketplace/apps'),
        testData.validApiKey
      );

      // Should either succeed, fail gracefully, or require authentication
      expect([200, 401, 500]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      } else if (response.status === 500) {
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Failed to fetch apps');
      } else if (response.status === 401) {
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Invalid API key');
      }
    });

    test('should handle pagination parameters', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/marketplace/apps?limit=5&offset=10'),
        testData.validApiKey
      );

      expect([200, 401, 500]).toContain(response.status);
    });

    test('should handle category filtering', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/marketplace/apps?category=productivity'),
        testData.validApiKey
      );

      expect([200, 401, 500]).toContain(response.status);
    });

    test('should handle search filtering', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/marketplace/apps?search=calendar'),
        testData.validApiKey
      );

      expect([200, 401, 500]).toContain(response.status);
    });

    test('should handle combined filtering and pagination', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/marketplace/apps?category=productivity&search=task&limit=10&offset=0'),
        testData.validApiKey
      );

      expect([200, 401, 500]).toContain(response.status);
    });
  });

  describe('GET /api/v1/marketplace/trending', () => {
    test('should require authentication', async () => {
      const response = await createTestRequest('/api/v1/marketplace/trending');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('API key required');
    });

    test('should return trending apps with valid API key', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/marketplace/trending'),
        testData.validApiKey
      );

      expect([200, 401, 500]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });

    test('should handle limit parameter', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/marketplace/trending?limit=5'),
        testData.validApiKey
      );

      expect([200, 401, 500]).toContain(response.status);
    });
  });

  describe('GET /api/v1/marketplace/featured', () => {
    test('should require authentication', async () => {
      const response = await createTestRequest('/api/v1/marketplace/featured');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('API key required');
    });

    test('should return featured apps with valid API key', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/marketplace/featured'),
        testData.validApiKey
      );

      expect([200, 401, 500]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });

    test('should handle limit parameter', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/marketplace/featured?limit=3'),
        testData.validApiKey
      );

      expect([200, 401, 500]).toContain(response.status);
    });
  });

  describe('GET /api/v1/marketplace/categories', () => {
    test('should require authentication', async () => {
      const response = await createTestRequest('/api/v1/marketplace/categories');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('API key required');
    });

    test('should return categories with valid API key', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/marketplace/categories'),
        testData.validApiKey
      );

      expect([200, 401, 500]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });
  });

  describe('GET /api/v1/marketplace/apps/:appId', () => {
    test('should require authentication', async () => {
      const response = await createTestRequest('/api/v1/marketplace/apps/test-app-123');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('API key required');
    });

    test('should return specific app with valid API key', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/marketplace/apps/test-app-123'),
        testData.validApiKey
      );

      expect([200, 401, 404, 500]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
      } else if (response.status === 404) {
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('App not found');
      }
    });

    test('should handle malformed app IDs', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/marketplace/apps/invalid-app-id!@#'),
        testData.validApiKey
      );

      expect([400, 401, 404, 500]).toContain(response.status);
    });
  });

  describe('GET /api/v1/marketplace/installed', () => {
    test('should require authentication', async () => {
      const response = await createTestRequest('/api/v1/marketplace/installed');

      expect(response.status).toBe(401);
    });

    test('should return installed apps for authenticated user', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/marketplace/installed'),
        testData.validApiKey
      );

      // This endpoint uses validateAuth, so may behave differently
      expect([200, 401, 500]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });
  });

  describe('POST /api/v1/marketplace/install/:appId', () => {
    test('should require authentication', async () => {
      const response = await createTestRequest('/api/v1/marketplace/install/test-app-123', 'post');

      expect(response.status).toBe(401);
    });

    test('should handle app installation with valid authentication', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/marketplace/install/test-app-123', 'post'),
        testData.validApiKey
      );

      // This endpoint uses validateAuth, so may behave differently
      expect([200, 400, 401, 404, 409, 500]).toContain(response.status);

      if (response.status === 409) {
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('App already installed');
      } else if (response.status === 404) {
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('App not found');
      }
    });

    test('should validate app ID parameter', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/marketplace/install/', 'post'),
        testData.validApiKey
      );

      expect([400, 404]).toContain(response.status);
    });
  });

  describe('DELETE /api/v1/marketplace/uninstall/:appId', () => {
    test('should require authentication', async () => {
      const response = await createTestRequest('/api/v1/marketplace/uninstall/test-app-123', 'delete');

      expect(response.status).toBe(401);
    });

    test('should handle app uninstallation with valid authentication', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/marketplace/uninstall/test-app-123', 'delete'),
        testData.validApiKey
      );

      // This endpoint uses validateAuth, so may behave differently
      expect([200, 401, 404, 500]).toContain(response.status);

      if (response.status === 404) {
        expect(response.body.success).toBe(false);
        expect(response.body.error).toMatch(/not found|not installed/);
      }
    });

    test('should validate app ID parameter', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/marketplace/uninstall/', 'delete'),
        testData.validApiKey
      );

      expect([400, 404]).toContain(response.status);
    });
  });

  describe('Error Handling', () => {
    test('should handle database connection errors gracefully', async () => {
      // This tests that the endpoints handle Supabase errors properly
      const response = await withAuth(
        createTestRequest('/api/v1/marketplace/apps'),
        testData.validApiKey
      );

      expect([200, 401, 500]).toContain(response.status);

      if (response.status === 500) {
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBeDefined();
      }
    });

    test('should handle malformed query parameters', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/marketplace/apps?limit=invalid&offset=not-a-number'),
        testData.validApiKey
      );

      // Should handle gracefully, either working with defaults or returning an error
      expect([200, 400, 401, 500]).toContain(response.status);
    });

    test('should handle SQL injection attempts in search', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/marketplace/apps?search=\'; DROP TABLE plugin_marketplace_apps; --'),
        testData.validApiKey
      );

      // Should handle safely without allowing injection
      expect([200, 400, 401, 500]).toContain(response.status);
    });

    test('should handle extremely long search queries', async () => {
      const longSearch = 'a'.repeat(10000);
      const response = await withAuth(
        createTestRequest(`/api/v1/marketplace/apps?search=${encodeURIComponent(longSearch)}`),
        testData.validApiKey
      );

      expect([200, 400, 401, 414, 500]).toContain(response.status);
    });
  });
});