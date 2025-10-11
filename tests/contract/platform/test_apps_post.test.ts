/**
 * Contract Test: POST /api/v1/platform/apps
 * Task: T006
 *
 * TDD Phase: RED - Test written before implementation
 * This test MUST fail initially before implementation
 */

import request from 'supertest';
import { createTestClient, TEST_USER_TOKENS } from '../../../test-utils/client';
import { cleanupRegisteredData, registerForCleanup } from '../../../test-utils/transactions';

describe('POST /api/v1/platform/apps', () => {
  let client: any;
  const testToken = TEST_USER_TOKENS.user1;

  beforeEach(() => {
    client = createTestClient();
  });

  afterEach(async () => {
    await cleanupRegisteredData();
  });

  describe('Contract Validation', () => {
    it('should accept valid app registration request', async () => {
      // Arrange
      const timestamp = Date.now();
      const validRequest = {
        app_id: `hugo_test_${timestamp}`,
        name: 'Hugo Test App',
        schema_name: `hugo_test_${timestamp}`,
        settings: {
          quotas: {
            max_users: 10000,
            max_storage_gb: 100,
            max_api_calls: 1000000,
          },
          features: ['coaching', 'ai_analysis', 'cross_app_insights'],
          personality_id: 'career_coach_v1',
        },
      };

      // Act
      const response = await request(client)
        .post('/api/v1/platform/apps')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`)
        .set('Content-Type', 'application/json')
        .send(validRequest);

      // Assert - Contract requirements
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: expect.any(String),
        app_id: validRequest.app_id,
        name: validRequest.name,
        schema_name: validRequest.schema_name,
        status: 'active',
        settings: expect.objectContaining({
          quotas: expect.any(Object),
          features: expect.any(Array),
        }),
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
      registerForCleanup('oriva_platform', 'apps', response.body.id);
    });

    it('should reject request without required app_id', async () => {
      // Arrange
      const invalidRequest = {
        name: 'Hugo Career',
        schema_name: 'hugo_career',
      };

      // Act
      const response = await request(client)
        .post('/api/v1/platform/apps')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`)
        .set('Content-Type', 'application/json')
        .send(invalidRequest);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: expect.stringContaining('app_id'),
      });
    });

    it('should reject request without required schema_name', async () => {
      // Arrange
      const invalidRequest = {
        app_id: 'hugo_career',
        name: 'Hugo Career',
      };

      // Act
      const response = await request(client)
        .post('/api/v1/platform/apps')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`)
        .set('Content-Type', 'application/json')
        .send(invalidRequest);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: expect.stringContaining('schema_name'),
      });
    });

    it('should reject duplicate app_id', async () => {
      // Arrange
      const duplicateRequest = {
        app_id: 'hugo_love', // Already exists
        name: 'Hugo Love Copy',
        schema_name: 'hugo_love_copy',
      };

      // Act
      const response = await request(client)
        .post('/api/v1/platform/apps')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`)
        .set('Content-Type', 'application/json')
        .send(duplicateRequest);

      // Assert
      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        code: 'APP_ID_EXISTS',
        message: expect.stringContaining('already exists'),
      });
    });

    it('should require API key authentication', async () => {
      // Arrange
      const validRequest = {
        app_id: 'hugo_career',
        name: 'Hugo Career',
        schema_name: 'hugo_career',
      };

      // Act - No API key
      const response = await request(client)
        .post('/api/v1/platform/apps')
        .set('Content-Type', 'application/json')
        .send(validRequest);

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'UNAUTHORIZED',
        message: expect.stringContaining('API key'),
      });
    });

    it('should validate schema_name format', async () => {
      // Arrange - Invalid schema name with spaces
      const invalidRequest = {
        app_id: 'hugo_career',
        name: 'Hugo Career',
        schema_name: 'hugo career', // Invalid - contains space
      };

      // Act
      const response = await request(client)
        .post('/api/v1/platform/apps')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`)
        .set('Content-Type', 'application/json')
        .send(invalidRequest);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'INVALID_SCHEMA_NAME',
        message: expect.stringContaining('valid PostgreSQL schema name'),
      });
    });

    it('should create database schema on app registration', async () => {
      // Arrange
      const validRequest = {
        app_id: 'hugo_test_' + Date.now(),
        name: 'Hugo Test App',
        schema_name: 'hugo_test_' + Date.now(),
      };

      // Act
      const response = await request(client)
        .post('/api/v1/platform/apps')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`)
        .set('Content-Type', 'application/json')
        .send(validRequest);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.schema_name).toBe(validRequest.schema_name);
      registerForCleanup('oriva_platform', 'apps', response.body.id);
    });
  });

  describe('OpenAPI Contract Compliance', () => {
    it('should match OpenAPI schema for successful response', async () => {
      // Arrange
      const timestamp = Date.now();
      const validRequest = {
        app_id: `hugo_openapi_${timestamp}`,
        name: 'Hugo OpenAPI Test',
        schema_name: `hugo_openapi_${timestamp}`,
        settings: {
          quotas: {
            max_users: 10000,
          },
          features: ['coaching'],
        },
      };

      // Act
      const response = await request(client)
        .post('/api/v1/platform/apps')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`)
        .set('Content-Type', 'application/json')
        .send(validRequest);

      // Assert - Exact OpenAPI schema compliance
      expect(response.status).toBe(201);
      const body = response.body;

      // Required fields per OpenAPI spec
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('app_id');
      expect(body).toHaveProperty('name');
      expect(body).toHaveProperty('schema_name');
      expect(body).toHaveProperty('status');

      // Type validation per OpenAPI spec
      expect(typeof body.id).toBe('string');
      expect(body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(typeof body.app_id).toBe('string');
      expect(typeof body.name).toBe('string');
      expect(typeof body.schema_name).toBe('string');
      expect(['active', 'inactive', 'extracting']).toContain(body.status);

      // Optional fields when present
      if (body.settings) {
        expect(typeof body.settings).toBe('object');
        if (body.settings.quotas) {
          expect(typeof body.settings.quotas).toBe('object');
        }
        if (body.settings.features) {
          expect(Array.isArray(body.settings.features)).toBe(true);
        }
      }
      registerForCleanup('oriva_platform', 'apps', body.id);
    });

    it('should return error matching OpenAPI Error schema', async () => {
      // Arrange
      const invalidRequest = {
        // Missing required fields
      };

      // Act
      const response = await request(client)
        .post('/api/v1/platform/apps')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`)
        .set('Content-Type', 'application/json')
        .send(invalidRequest);

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
