/**
 * Contract Test: GET /api/v1/platform/users/{userId}/apps
 * Task: T008
 *
 * TDD Phase: GREEN - Testing with real database
 * Uses seeded test data from database
 */

import request from 'supertest';
import { createTestClient } from '../../../test-utils/client';

describe('GET /api/v1/platform/users/{userId}/apps', () => {
  // Use actual user IDs from seed data
  const testUserId = '00000000-0000-0000-0000-000000000002'; // Bob Smith - has access to both hugo_love and hugo_career
  const singleAppUserId = '00000000-0000-0000-0000-000000000001'; // Alice Johnson - only hugo_love

  // Note: createTestClient() returns supertest agent, use directly without request() wrapper

  describe('Contract Validation', () => {
    it("should return user's accessible apps with roles", async () => {
      // Arrange
      const client = createTestClient();

      // Act - Bob has access to both hugo_love and hugo_career from seed data
      const response = await request(client)
        .get(`/api/v1/platform/users/${testUserId}/apps`)
        .set('X-API-Key', 'test-api-key');

      // Assert - Contract requirements
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('apps');
      expect(Array.isArray(response.body.apps)).toBe(true);
      expect(response.body.apps.length).toBeGreaterThanOrEqual(2); // Bob has at least 2 apps

      // Validate structure
      const firstApp = response.body.apps[0];
      expect(firstApp).toMatchObject({
        app: {
          id: expect.any(String),
          app_id: expect.any(String),
          name: expect.any(String),
          schema_name: expect.any(String),
          status: expect.stringMatching(/^(active|inactive|extracting)$/),
        },
        role: expect.stringMatching(/^(user|admin|owner)$/),
        joined_at: expect.any(String),
      });

      // Verify Bob has access to both apps from seed data
      const appIds = response.body.apps.map((a: any) => a.app.app_id);
      expect(appIds).toContain('hugo_love');
      expect(appIds).toContain('hugo_career');
    });

    it('should filter by app status when provided', async () => {
      const client = createTestClient();

      // Act
      const response = await request(client)
        .get(`/api/v1/platform/users/${testUserId}/apps?status=active`)
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.apps.length).toBeGreaterThan(0);
      // All returned apps should have active status
      response.body.apps.forEach((item: any) => {
        expect(item.app.status).toBe('active');
      });
    });

    it('should return 404 for non-existent user', async () => {
      // Arrange - Use a valid UUID that doesn't exist in database
      const nonExistentUserId = '999e8400-e29b-41d4-a716-446655440999';

      const client = createTestClient();

      // Act
      const response = await request(client)
        .get(`/api/v1/platform/users/${nonExistentUserId}/apps`)
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        code: 'USER_NOT_FOUND',
        message: expect.stringContaining('User not found'),
      });
    });

    it('should validate UUID format for userId', async () => {
      // Arrange
      const invalidUserId = 'not-a-uuid';

      const client = createTestClient();

      // Act
      const response = await request(client)
        .get(`/api/v1/platform/users/${invalidUserId}/apps`)
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'INVALID_USER_ID',
        message: expect.stringContaining('Invalid user ID format'),
      });
    });

    it('should require API key authentication', async () => {
      const client = createTestClient();

      // Act - No API key
      const response = await request(client).get(`/api/v1/platform/users/${testUserId}/apps`);

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'UNAUTHORIZED',
        message: expect.stringContaining('API key'),
      });
    });

    it('should include only active user-app relationships by default', async () => {
      const client = createTestClient();

      // Act
      const response = await request(client)
        .get(`/api/v1/platform/users/${testUserId}/apps`)
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.apps.length).toBeGreaterThan(0);
      // All user-app relationships should be active (from seed data all are active)
      expect(response.body.apps.every((a: any) => a.status === 'active')).toBe(true);
    });
  });

  describe('OpenAPI Contract Compliance', () => {
    it('should match OpenAPI schema for successful response', async () => {
      const client = createTestClient();

      // Act - Use real database data
      const response = await request(client)
        .get(`/api/v1/platform/users/${testUserId}/apps`)
        .set('X-API-Key', 'test-api-key');

      // Assert - Exact OpenAPI schema compliance
      expect(response.status).toBe(200);
      const body = response.body;

      // Response wrapper
      expect(body).toHaveProperty('apps');
      expect(Array.isArray(body.apps)).toBe(true);
      expect(body.apps.length).toBeGreaterThan(0);

      // Validate each user-app relationship
      body.apps.forEach((item: any) => {
        // App object validation
        expect(item).toHaveProperty('app');
        const app = item.app;
        expect(app).toHaveProperty('id');
        expect(app).toHaveProperty('app_id');
        expect(app).toHaveProperty('name');
        expect(app).toHaveProperty('schema_name');
        expect(app).toHaveProperty('status');

        // Type validation for app
        expect(typeof app.id).toBe('string');
        expect(app.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        expect(['active', 'inactive', 'extracting']).toContain(app.status);

        // User-app relationship fields
        expect(item).toHaveProperty('role');
        expect(item).toHaveProperty('joined_at');
        expect(typeof item.role).toBe('string');
        expect(['user', 'admin', 'owner']).toContain(item.role);
        expect(typeof item.joined_at).toBe('string');
        expect(new Date(item.joined_at).toISOString()).toBe(item.joined_at);

        // Optional fields
        if (item.last_active_at !== undefined) {
          expect(typeof item.last_active_at).toBe('string');
          expect(new Date(item.last_active_at).toISOString()).toBe(item.last_active_at);
        }

        if (item.settings !== undefined) {
          expect(typeof item.settings).toBe('object');
        }
      });
    });

    it('should return error matching OpenAPI Error schema', async () => {
      // Arrange - Invalid userId to trigger error
      const invalidUserId = 'invalid-uuid-format';

      const client = createTestClient();

      // Act
      const response = await request(client)
        .get(`/api/v1/platform/users/${invalidUserId}/apps`)
        .set('X-API-Key', 'test-api-key');

      // Assert - Error schema per OpenAPI spec
      expect(response.status).toBe(400);
      const error = response.body;

      // Required error fields per OpenAPI spec
      expect(error).toHaveProperty('code');
      expect(error).toHaveProperty('message');
      expect(typeof error.code).toBe('string');
      expect(typeof error.message).toBe('string');

      // Optional error details
      if (error.details) {
        expect(typeof error.details).toBe('object');
      }
    });
  });
});
