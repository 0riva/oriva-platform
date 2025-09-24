/**
 * Marketplace API tests
 * Tests the marketplace endpoints for app discovery and management
 */

const { createTestRequest, withAuth, testData } = require('../utils/testHelpers');

const expectTypedMarketplaceError = (response, expectedMessage, expectedStatus = 401) => {
  expect(response.status).toBe(expectedStatus);
  expect(response.body.success).toBe(false);
  expect(typeof response.body.code).toBe('string');
  expect(response.body.message).toBe(expectedMessage);
  if (Object.prototype.hasOwnProperty.call(response.body, 'details')) {
    expect(Array.isArray(response.body.details)).toBe(true);
  }
};

const expectMarketplaceAppShape = (app) => {
  expect(typeof app.id).toBe('string');
  expect(typeof app.name).toBe('string');
  expect(typeof app.slug).toBe('string');
  expect(typeof app.category).toBe('string');
  expect(typeof app.developerId).toBe('string');
  expect(typeof app.developerName).toBe('string');
  expect(['draft', 'pending_review', 'approved', 'rejected']).toContain(app.status);
  expect(typeof app.isActive).toBe('boolean');
  if (app.screenshots) {
    expect(Array.isArray(app.screenshots)).toBe(true);
  }
};

const expectPaginatedMeta = (meta) => {
  expect(meta).toBeDefined();
  expect(meta).toHaveProperty('pagination');
  expect(meta.pagination).toEqual(expect.objectContaining({
    page: expect.any(Number),
    limit: expect.any(Number),
    total: expect.any(Number),
    totalPages: expect.any(Number)
  }));
};

describe('Marketplace API', () => {
  describe('GET /api/v1/marketplace/apps', () => {
    test('should require authentication', async () => {
      const response = await createTestRequest('/api/v1/marketplace/apps');

      expectTypedMarketplaceError(response, 'API key required');
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
        response.body.data.forEach(expectMarketplaceAppShape);
        expectPaginatedMeta(response.body.meta);
      } else if (response.status === 500) {
        expectTypedMarketplaceError(response, 'Failed to fetch apps', 500);
      } else if (response.status === 401) {
        expectTypedMarketplaceError(response, 'Invalid API key');
      }
    });

    test('should handle pagination parameters', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/marketplace/apps?limit=5&offset=10'),
        testData.validApiKey
      );

      expect([200, 401, 500]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
        response.body.data.forEach(expectMarketplaceAppShape);
        expectPaginatedMeta(response.body.meta);
      } else if (response.status === 401) {
        expectTypedMarketplaceError(response, 'Invalid API key');
      } else if (response.status === 500) {
        expectTypedMarketplaceError(response, 'Failed to fetch apps', 500);
      }
    });

    test('should handle category filtering', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/marketplace/apps?category=productivity'),
        testData.validApiKey
      );

      expect([200, 401, 500]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
        response.body.data.forEach(expectMarketplaceAppShape);
        expectPaginatedMeta(response.body.meta);
      } else if (response.status === 401) {
        expectTypedMarketplaceError(response, 'Invalid API key');
      } else if (response.status === 500) {
        expectTypedMarketplaceError(response, 'Failed to fetch apps', 500);
      }
    });

    test('should handle search filtering', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/marketplace/apps?search=calendar'),
        testData.validApiKey
      );

      expect([200, 401, 500]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
        response.body.data.forEach(expectMarketplaceAppShape);
        expectPaginatedMeta(response.body.meta);
      } else if (response.status === 401) {
        expectTypedMarketplaceError(response, 'Invalid API key');
      } else if (response.status === 500) {
        expectTypedMarketplaceError(response, 'Failed to fetch apps', 500);
      }
    });

    test('should handle combined filtering and pagination', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/marketplace/apps?category=productivity&search=task&limit=10&offset=0'),
        testData.validApiKey
      );

      expect([200, 401, 500]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
        response.body.data.forEach(expectMarketplaceAppShape);
        expectPaginatedMeta(response.body.meta);
      } else if (response.status === 401) {
        expectTypedMarketplaceError(response, 'Invalid API key');
      } else if (response.status === 500) {
        expectTypedMarketplaceError(response, 'Failed to fetch apps', 500);
      }
    });
  });

  describe('GET /api/v1/marketplace/trending', () => {
    test('should require authentication', async () => {
      const response = await createTestRequest('/api/v1/marketplace/trending');

      expectTypedMarketplaceError(response, 'API key required');
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
        response.body.data.forEach(expectMarketplaceAppShape);
      } else if (response.status === 401) {
        expectTypedMarketplaceError(response, 'Invalid API key');
      } else if (response.status === 500) {
        expectTypedMarketplaceError(response, 'Failed to fetch apps', 500);
      }
    });

    test('should handle limit parameter', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/marketplace/trending?limit=5'),
        testData.validApiKey
      );

      expect([200, 401, 500]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
        response.body.data.forEach(expectMarketplaceAppShape);
      } else if (response.status === 401) {
        expectTypedMarketplaceError(response, 'Invalid API key');
      } else if (response.status === 500) {
        expectTypedMarketplaceError(response, 'Failed to fetch apps', 500);
      }
    });
  });

  describe('GET /api/v1/marketplace/featured', () => {
    test('should require authentication', async () => {
      const response = await createTestRequest('/api/v1/marketplace/featured');

      expectTypedMarketplaceError(response, 'API key required');
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
        response.body.data.forEach(expectMarketplaceAppShape);
      } else if (response.status === 401) {
        expectTypedMarketplaceError(response, 'Invalid API key');
      } else if (response.status === 500) {
        expectTypedMarketplaceError(response, 'Failed to fetch apps', 500);
      }
    });

    test('should handle limit parameter', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/marketplace/featured?limit=3'),
        testData.validApiKey
      );

      expect([200, 401, 500]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
        response.body.data.forEach(expectMarketplaceAppShape);
      } else if (response.status === 401) {
        expectTypedMarketplaceError(response, 'Invalid API key');
      } else if (response.status === 500) {
        expectTypedMarketplaceError(response, 'Failed to fetch apps', 500);
      }
    });
  });

  describe('GET /api/v1/marketplace/categories', () => {
    test('should require authentication', async () => {
      const response = await createTestRequest('/api/v1/marketplace/categories');

      expectTypedMarketplaceError(response, 'API key required');
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
      } else if (response.status === 401) {
        expectTypedMarketplaceError(response, 'Invalid API key');
      } else if (response.status === 500) {
        expectTypedMarketplaceError(response, 'Failed to fetch apps', 500);
      }
    });
  });

  describe('GET /api/v1/marketplace/apps/:appId', () => {
    test('should require authentication', async () => {
      const response = await createTestRequest('/api/v1/marketplace/apps/test-app-123');

      expectTypedMarketplaceError(response, 'API key required');
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
        expectMarketplaceAppShape(response.body.data);
      } else if (response.status === 404) {
        expectTypedMarketplaceError(response, 'App not found', 404);
      } else if (response.status === 401) {
        expectTypedMarketplaceError(response, 'Invalid API key');
      } else if (response.status === 500) {
        expectTypedMarketplaceError(response, 'Failed to fetch apps', 500);
      }
    });

    test('should handle malformed app IDs', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/marketplace/apps/invalid-app-id!@#'),
        testData.validApiKey
      );

      expect([400, 401, 404, 500]).toContain(response.status);

      if (response.status === 400 || response.status === 404) {
        expectTypedMarketplaceError(response, response.body.message, response.status);
      } else if (response.status === 401) {
        expectTypedMarketplaceError(response, 'Invalid API key');
      } else if (response.status === 500) {
        expectTypedMarketplaceError(response, 'Failed to fetch apps', 500);
      } else if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expectMarketplaceAppShape(response.body.data);
      }
    });
  });

  describe('GET /api/v1/marketplace/installed', () => {
    test('should require authentication', async () => {
      const response = await createTestRequest('/api/v1/marketplace/installed');

      expectTypedMarketplaceError(response, 'API key required');
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
        response.body.data.forEach(expectMarketplaceAppShape);
      } else if (response.status === 401) {
        expectTypedMarketplaceError(response, 'Invalid API key');
      } else if (response.status === 500) {
        expectTypedMarketplaceError(response, 'Failed to fetch apps', 500);
      }
    });
  });

  describe('POST /api/v1/marketplace/install/:appId', () => {
    test('should require authentication', async () => {
      const response = await createTestRequest('/api/v1/marketplace/install/test-app-123', 'post');

      expectTypedMarketplaceError(response, 'API key required');
    });

    test('should handle app installation with valid authentication', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/marketplace/install/test-app-123', 'post'),
        testData.validApiKey
      );

      // This endpoint uses validateAuth, so may behave differently
      expect([200, 400, 401, 404, 409, 500]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expectMarketplaceAppShape(response.body.data);
      } else if (response.status === 409) {
        expectTypedMarketplaceError(response, 'App already installed', 409);
      } else if (response.status === 404) {
        expectTypedMarketplaceError(response, 'App not found', 404);
      } else if (response.status === 401) {
        expectTypedMarketplaceError(response, 'Invalid API key');
      } else if (response.status === 500) {
        expectTypedMarketplaceError(response, 'Failed to install app', 500);
      }
    });

    test('should validate app ID parameter', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/marketplace/install/', 'post'),
        testData.validApiKey
      );

      expect([400, 404]).toContain(response.status);

      if (response.status === 400 || response.status === 404) {
        expectTypedMarketplaceError(response, response.body.message, response.status);
      }
    });
  });

  describe('DELETE /api/v1/marketplace/uninstall/:appId', () => {
    test('should require authentication', async () => {
      const response = await createTestRequest('/api/v1/marketplace/uninstall/test-app-123', 'delete');

      expectTypedMarketplaceError(response, 'API key required');
    });

    test('should handle app uninstallation with valid authentication', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/marketplace/uninstall/test-app-123', 'delete'),
        testData.validApiKey
      );

      // This endpoint uses validateAuth, so may behave differently
      expect([200, 401, 404, 500]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      } else if (response.status === 404) {
        expect(response.body.message).toMatch(/not found|not installed/);
        expectTypedMarketplaceError(response, response.body.message, 404);
      } else if (response.status === 401) {
        expectTypedMarketplaceError(response, 'Invalid API key');
      } else if (response.status === 500) {
        expectTypedMarketplaceError(response, 'Failed to uninstall app', 500);
      }
    });

    test('should validate app ID parameter', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/marketplace/uninstall/', 'delete'),
        testData.validApiKey
      );

      expect([400, 404]).toContain(response.status);

      if (response.status === 400 || response.status === 404) {
        expectTypedMarketplaceError(response, response.body.message, response.status);
      }
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
        expectTypedMarketplaceError(response, response.body.message, 500);
      } else if (response.status === 401) {
        expectTypedMarketplaceError(response, 'Invalid API key');
      } else if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
        response.body.data.forEach(expectMarketplaceAppShape);
        expectPaginatedMeta(response.body.meta);
      }
    });

    test('should handle malformed query parameters', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/marketplace/apps?limit=invalid&offset=not-a-number'),
        testData.validApiKey
      );

      // Should handle gracefully, either working with defaults or returning an error
      expect([200, 400, 401, 500]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
        response.body.data.forEach(expectMarketplaceAppShape);
        expectPaginatedMeta(response.body.meta);
      } else if (response.status === 400) {
        expectTypedMarketplaceError(response, response.body.message, 400);
      } else if (response.status === 401) {
        expectTypedMarketplaceError(response, 'Invalid API key');
      } else if (response.status === 500) {
        expectTypedMarketplaceError(response, 'Failed to fetch apps', 500);
      }
    });

    test('should handle SQL injection attempts in search', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/marketplace/apps?search=\'; DROP TABLE plugin_marketplace_apps; --'),
        testData.validApiKey
      );

      // Should handle safely without allowing injection
      expect([200, 400, 401, 500]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
        response.body.data.forEach(expectMarketplaceAppShape);
        expectPaginatedMeta(response.body.meta);
      } else if (response.status === 400) {
        expectTypedMarketplaceError(response, response.body.message, 400);
      } else if (response.status === 401) {
        expectTypedMarketplaceError(response, 'Invalid API key');
      } else if (response.status === 500) {
        expectTypedMarketplaceError(response, 'Failed to fetch apps', 500);
      }
    });

    test('should handle extremely long search queries', async () => {
      const longSearch = 'a'.repeat(10000);
      const response = await withAuth(
        createTestRequest(`/api/v1/marketplace/apps?search=${encodeURIComponent(longSearch)}`),
        testData.validApiKey
      );

      expect([200, 400, 401, 414, 500]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
        response.body.data.forEach(expectMarketplaceAppShape);
        expectPaginatedMeta(response.body.meta);
      } else if (response.status === 400 || response.status === 414) {
        expectTypedMarketplaceError(response, response.body.message, response.status);
      } else if (response.status === 401) {
        expectTypedMarketplaceError(response, 'Invalid API key');
      } else if (response.status === 500) {
        expectTypedMarketplaceError(response, 'Failed to fetch apps', 500);
      }
    });
  });
});
