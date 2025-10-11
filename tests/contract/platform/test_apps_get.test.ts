/**
 * Contract Test: GET /api/v1/platform/apps
 * Task: T007
 *
 * TDD Phase: GREEN - Testing with real database
 * Uses seeded test data from database
 */

import request from 'supertest';
import { createTestClient } from '../../../test-utils/client';

describe('GET /api/v1/platform/apps', () => {
  // Note: createTestClient() returns Express app, use with request() wrapper

  describe('Contract Validation', () => {
    it('should return list of available apps', async () => {
      // Arrange
      const client = createTestClient();

      // Act - Real database has hugo_love and hugo_career from seed data
      const response = await request(client)
        .get('/api/v1/platform/apps')
        .set('X-API-Key', 'test-api-key');

      // Assert - Contract requirements
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('apps');
      expect(Array.isArray(response.body.apps)).toBe(true);
      expect(response.body.apps.length).toBeGreaterThanOrEqual(2); // At least hugo_love and hugo_career

      // Validate first app structure
      const firstApp = response.body.apps[0];
      expect(firstApp).toMatchObject({
        id: expect.any(String),
        app_id: expect.any(String),
        name: expect.any(String),
        schema_name: expect.any(String),
        status: expect.stringMatching(/^(active|inactive|extracting)$/),
      });

      // Verify both apps from seed data exist
      const appIds = response.body.apps.map((a: any) => a.app_id);
      expect(appIds).toContain('hugo_love');
      expect(appIds).toContain('hugo_career');
    });

    it('should filter apps by status when provided', async () => {
      const client = createTestClient();

      // Act
      const response = await request(client)
        .get('/api/v1/platform/apps?status=active')
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.apps.length).toBeGreaterThan(0);
      // All returned apps should have active status
      response.body.apps.forEach((app: any) => {
        expect(app.status).toBe('active');
      });
    });

    it('should require API key authentication', async () => {
      const client = createTestClient();

      // Act - No API key
      const response = await request(client).get('/api/v1/platform/apps');

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'UNAUTHORIZED',
        message: expect.stringContaining('API key'),
      });
    });

    it('should support pagination parameters', async () => {
      const client = createTestClient();

      // Act
      const response = await request(client)
        .get('/api/v1/platform/apps?limit=1&offset=0')
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.apps.length).toBeLessThanOrEqual(1);
    });
  });

  describe('OpenAPI Contract Compliance', () => {
    it('should match OpenAPI schema for successful response', async () => {
      const client = createTestClient();

      // Act - Use real database data
      const response = await request(client)
        .get('/api/v1/platform/apps')
        .set('X-API-Key', 'test-api-key');

      // Assert - Exact OpenAPI schema compliance
      expect(response.status).toBe(200);
      const body = response.body;

      // Response wrapper
      expect(body).toHaveProperty('apps');
      expect(Array.isArray(body.apps)).toBe(true);
      expect(body.apps.length).toBeGreaterThan(0);

      // Validate each app in array
      body.apps.forEach((app: any) => {
        // Required fields per OpenAPI spec
        expect(app).toHaveProperty('id');
        expect(app).toHaveProperty('app_id');
        expect(app).toHaveProperty('name');
        expect(app).toHaveProperty('schema_name');
        expect(app).toHaveProperty('status');

        // Type validation per OpenAPI spec
        expect(typeof app.id).toBe('string');
        expect(app.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        expect(typeof app.app_id).toBe('string');
        expect(typeof app.name).toBe('string');
        expect(typeof app.schema_name).toBe('string');
        expect(['active', 'inactive', 'extracting']).toContain(app.status);

        // Optional fields validation when present
        if (app.description !== undefined) {
          expect(typeof app.description).toBe('string');
        }

        if (app.settings) {
          expect(typeof app.settings).toBe('object');

          if (app.settings.quotas) {
            expect(typeof app.settings.quotas).toBe('object');
          }

          if (app.settings.features) {
            expect(Array.isArray(app.settings.features)).toBe(true);
            app.settings.features.forEach((feature: any) => {
              expect(typeof feature).toBe('string');
            });
          }

          if (app.settings.personality_id !== undefined) {
            expect(typeof app.settings.personality_id).toBe('string');
          }
        }
      });
    });

    it('should return error matching OpenAPI Error schema', async () => {
      // Arrange - Use invalid API key to trigger error
      const client = createTestClient();

      // Act
      const response = await request(client)
        .get('/api/v1/platform/apps')
        .set('X-API-Key', 'invalid-key-format');

      // Assert - Error schema per OpenAPI spec
      expect(response.status).toBeGreaterThanOrEqual(400);
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
