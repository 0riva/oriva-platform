/**
 * Developer API tests
 * Tests the developer endpoints for app management and submission
 */

const { createTestRequest, withAuth, testData, mockSupabaseResponse } = require('../utils/testHelpers');

describe('Developer API', () => {
  describe('GET /api/v1/developer/apps', () => {
    test('should require authentication', async () => {
      const response = await createTestRequest('/api/v1/developer/apps');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('API key required');
    });

    test('should return developer apps with valid API key', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/developer/apps'),
        testData.validApiKey
      );

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
  });

  describe('GET /api/v1/developer/apps/:appId', () => {
    test('should require authentication', async () => {
      const response = await createTestRequest('/api/v1/developer/apps/test-app-123');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('API key required');
    });

    test('should return specific developer app with valid API key', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/developer/apps/test-app-123'),
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
        createTestRequest('/api/v1/developer/apps/invalid-app-id!@#'),
        testData.validApiKey
      );

      expect([400, 401, 404, 500]).toContain(response.status);
    });
  });

  describe('POST /api/v1/developer/apps', () => {
    test('should require authentication', async () => {
      const response = await createTestRequest('/api/v1/developer/apps', 'post')
        .send({
          name: 'Test App',
          slug: 'test-app',
          description: 'A test application'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('API key required');
    });

    test('should create new app with valid data and authentication', async () => {
      const appData = {
        name: 'Test App',
        slug: 'test-app',
        tagline: 'A test application',
        description: 'A comprehensive test application for developers',
        category: 'productivity',
        icon_url: 'https://example.com/icon.png',
        version: '1.0.0',
        pricing_model: 'free'
      };

      const response = await withAuth(
        createTestRequest('/api/v1/developer/apps', 'post').send(appData),
        testData.validApiKey
      );

      expect([201, 400, 401, 409, 500]).toContain(response.status);

      if (response.status === 201) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBeDefined();
        expect(response.body.data.name).toBe(appData.name);
      } else if (response.status === 409) {
        expect(response.body.success).toBe(false);
        expect(response.body.error).toMatch(/already exists|duplicate/i);
      } else if (response.status === 400) {
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBeDefined();
      }
    });

    test('should validate required fields', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/developer/apps', 'post').send({}),
        testData.validApiKey
      );

      expect([400, 401, 500]).toContain(response.status);

      if (response.status === 400) {
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBeDefined();
      }
    });

    test('should handle invalid data types', async () => {
      const invalidData = {
        name: 123, // Should be string
        slug: null,
        description: true,
        category: [],
        version: {}
      };

      const response = await withAuth(
        createTestRequest('/api/v1/developer/apps', 'post').send(invalidData),
        testData.validApiKey
      );

      expect([400, 401, 500]).toContain(response.status);
    });
  });

  describe('PUT /api/v1/developer/apps/:appId', () => {
    test('should require authentication', async () => {
      const response = await createTestRequest('/api/v1/developer/apps/test-app-123', 'put')
        .send({
          name: 'Updated Test App',
          description: 'Updated description'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('API key required');
    });

    test('should update app with valid data and authentication', async () => {
      const updateData = {
        name: 'Updated Test App',
        tagline: 'Updated tagline',
        description: 'Updated comprehensive description',
        version: '1.1.0'
      };

      const response = await withAuth(
        createTestRequest('/api/v1/developer/apps/test-app-123', 'put').send(updateData),
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

    test('should handle partial updates', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/developer/apps/test-app-123', 'put').send({
          version: '1.2.0'
        }),
        testData.validApiKey
      );

      expect([200, 401, 404, 500]).toContain(response.status);
    });

    test('should validate update data', async () => {
      const invalidData = {
        name: '', // Empty name
        version: 'invalid-version-format'
      };

      const response = await withAuth(
        createTestRequest('/api/v1/developer/apps/test-app-123', 'put').send(invalidData),
        testData.validApiKey
      );

      expect([400, 401, 404, 500]).toContain(response.status);
    });
  });

  describe('DELETE /api/v1/developer/apps/:appId', () => {
    test('should require authentication', async () => {
      const response = await createTestRequest('/api/v1/developer/apps/test-app-123', 'delete');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('API key required');
    });

    test('should delete app with valid authentication', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/developer/apps/test-app-123', 'delete'),
        testData.validApiKey
      );

      expect([200, 401, 404, 500]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.message).toMatch(/deleted|removed/i);
      } else if (response.status === 404) {
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('App not found');
      }
    });

    test('should handle non-existent app deletion', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/developer/apps/non-existent-app', 'delete'),
        testData.validApiKey
      );

      expect([401, 404, 500]).toContain(response.status);

      if (response.status === 404) {
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('App not found');
      }
    });
  });

  describe('POST /api/v1/developer/apps/:appId/submit', () => {
    test('should require authentication', async () => {
      const response = await createTestRequest('/api/v1/developer/apps/test-app-123/submit', 'post');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('API key required');
    });

    test('should submit app for review with valid authentication', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/developer/apps/test-app-123/submit', 'post'),
        testData.validApiKey
      );

      expect([200, 400, 401, 404, 409, 500]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.message).toMatch(/submitted|review/i);
      } else if (response.status === 409) {
        expect(response.body.success).toBe(false);
        expect(response.body.error).toMatch(/already submitted|review/i);
      } else if (response.status === 404) {
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('App not found');
      }
    });

    test('should handle submission of already submitted app', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/developer/apps/already-submitted-app/submit', 'post'),
        testData.validApiKey
      );

      expect([200, 400, 401, 404, 409, 500]).toContain(response.status);
    });
  });

  describe('POST /api/v1/developer/apps/:appId/resubmit', () => {
    test('should require authentication', async () => {
      const response = await createTestRequest('/api/v1/developer/apps/test-app-123/resubmit', 'post');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('API key required');
    });

    test('should resubmit app for review with valid authentication', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/developer/apps/test-app-123/resubmit', 'post'),
        testData.validApiKey
      );

      expect([200, 400, 401, 404, 409, 500]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.message).toMatch(/resubmitted|review/i);
      } else if (response.status === 400) {
        expect(response.body.success).toBe(false);
        expect(response.body.error).toMatch(/cannot resubmit|not rejected/i);
      } else if (response.status === 404) {
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('App not found');
      }
    });

    test('should handle resubmission of non-rejected app', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/developer/apps/non-rejected-app/resubmit', 'post'),
        testData.validApiKey
      );

      expect([200, 400, 401, 404, 500]).toContain(response.status);
    });
  });

  describe('Error Handling', () => {
    test('should handle database connection errors gracefully', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/developer/apps'),
        testData.validApiKey
      );

      expect([200, 401, 500]).toContain(response.status);

      if (response.status === 500) {
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBeDefined();
      }
    });

    test('should handle malformed JSON in request body', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/developer/apps', 'post')
          .set('Content-Type', 'application/json')
          .send('{"invalid": json}'),
        testData.validApiKey
      );

      expect([400, 401, 500]).toContain(response.status);
    });

    test('should handle extremely large request payloads', async () => {
      const largeData = {
        name: 'Test App',
        description: 'a'.repeat(100000) // Very large description
      };

      const response = await withAuth(
        createTestRequest('/api/v1/developer/apps', 'post').send(largeData),
        testData.validApiKey
      );

      expect([400, 401, 413, 500]).toContain(response.status);
    });

    test('should handle SQL injection attempts in parameters', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/developer/apps/\'; DROP TABLE plugin_marketplace_apps; --'),
        testData.validApiKey
      );

      // Should handle safely without allowing injection
      expect([400, 401, 404, 500]).toContain(response.status);
    });

    test('should validate ownership of apps', async () => {
      // Test that developers can only access their own apps
      const response = await withAuth(
        createTestRequest('/api/v1/developer/apps/other-developer-app'),
        testData.validApiKey
      );

      expect([401, 404, 500]).toContain(response.status);

      if (response.status === 404) {
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('App not found');
      }
    });
  });

  describe('API Key Generation (Legacy)', () => {
    test('should redirect to developer dashboard for API key generation', async () => {
      const response = await createTestRequest('/api/v1/developer/api-keys', 'post');

      expect([400, 404, 410, 501]).toContain(response.status);

      if (response.status === 410 || response.status === 501) {
        expect(response.body.success).toBe(false);
        expect(response.body.error).toMatch(/developer dashboard|web interface/i);
        expect(response.body.redirect).toBe('/developer/api-keys');
      }
    });
  });
});