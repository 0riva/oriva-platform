/**
 * Contract Test: POST /api/v1/hugo-ai/sessions
 * Task: T009
 *
 * TDD Phase: RED - Test written before implementation
 * This test MUST fail initially before implementation
 */

import request from 'supertest';
import { createTestClient, TEST_USER_TOKENS } from '../../../test-utils/client';
import { cleanupRegisteredData, registerForCleanup } from '../../../test-utils/transactions';

describe('POST /api/v1/hugo-ai/sessions', () => {
  let client: any;
  const testToken = TEST_USER_TOKENS.user1; // Alice
  const testUserId = '00000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    client = createTestClient();
  });

  afterEach(async () => {
    await cleanupRegisteredData();
  });

  describe('Contract Validation', () => {
    it('should start a new coaching session', async () => {
      // Arrange
      const validRequest = {
        user_id: testUserId,
        session_type: 'coaching',
        context_data: {
          domain: 'dating',
          goals: ['improve_confidence', 'better_conversations'],
          mood: 'optimistic',
          topic: 'first_date_preparation',
        },
      };

      // Act
      const response = await request(client)
        .post('/api/v1/hugo-ai/sessions')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`)
        .set('Content-Type', 'application/json')
        .send(validRequest);

      // Assert - Contract requirements
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: expect.any(String),
        user_id: testUserId,
        app_id: expect.any(String),
        session_type: 'coaching',
        started_at: expect.any(String),
        message_count: 0,
        context_data: expect.objectContaining({
          domain: 'dating',
          goals: expect.any(Array),
        }),
      });

      registerForCleanup('hugo_ai', 'sessions', response.body.id);
    });

    it('should validate session_type enum', async () => {
      // Arrange
      const invalidRequest = {
        user_id: testUserId,
        session_type: 'invalid_type',
        context_data: {
          domain: 'dating',
        },
      };

      // Act
      const response = await request(client)
        .post('/api/v1/hugo-ai/sessions')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`)
        .set('Content-Type', 'application/json')
        .send(invalidRequest);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'INVALID_SESSION_TYPE',
        message: expect.stringContaining('chat, analysis, coaching, or practice'),
      });
    });

    it('should require session_type field', async () => {
      // Arrange
      const invalidRequest = {
        user_id: testUserId,
        context_data: {
          domain: 'dating',
        },
      };

      // Act
      const response = await request(client)
        .post('/api/v1/hugo-ai/sessions')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`)
        .set('Content-Type', 'application/json')
        .send(invalidRequest);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: expect.stringContaining('session_type'),
      });
    });

    it('should require X-App-ID header for schema routing', async () => {
      // Arrange
      const validRequest = {
        user_id: testUserId,
        session_type: 'chat',
        context_data: {},
      };

      // Act - Missing X-App-ID header
      const response = await request(client)
        .post('/api/v1/hugo-ai/sessions')
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(validRequest);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'MISSING_APP_ID',
        message: expect.stringContaining('X-App-ID header'),
      });
    });

    it('should require API key authentication', async () => {
      // Arrange
      const validRequest = {
        user_id: testUserId,
        session_type: 'chat',
        context_data: {},
      };

      // Act - No API key
      const response = await request(client)
        .post('/api/v1/hugo-ai/sessions')
        .set('X-App-ID', 'hugo_love')
        .set('Content-Type', 'application/json')
        .send(validRequest);

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'UNAUTHORIZED',
        message: expect.stringContaining('API key'),
      });
    });

    it('should accept all valid session types', async () => {
      const sessionTypes = ['chat', 'analysis', 'coaching', 'practice'];

      for (const sessionType of sessionTypes) {
        // Arrange
        const validRequest = {
          user_id: testUserId,
          session_type: sessionType,
          context_data: {
            domain: 'dating',
          },
        };

        // Act
        const response = await request(client)
          .post('/api/v1/hugo-ai/sessions')
          .set('X-App-ID', 'hugo_love')
          .set('X-API-Key', 'test-api-key')
          .set('Authorization', `Bearer ${testToken}`)
          .set('Content-Type', 'application/json')
          .send(validRequest);

        // Assert
        expect(response.status).toBe(201);
        expect(response.body.session_type).toBe(sessionType);

        registerForCleanup('hugo_ai', 'sessions', response.body.id);
      }
    });

    it('should handle optional context_data gracefully', async () => {
      // Arrange
      const minimalRequest = {
        user_id: testUserId,
        session_type: 'chat',
      };

      // Act
      const response = await request(client)
        .post('/api/v1/hugo-ai/sessions')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`)
        .set('Content-Type', 'application/json')
        .send(minimalRequest);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('context_data');

      registerForCleanup('hugo_ai', 'sessions', response.body.id);
    });
  });

  describe('OpenAPI Contract Compliance', () => {
    it('should match OpenAPI schema for successful response', async () => {
      // Arrange
      const validRequest = {
        user_id: testUserId,
        session_type: 'coaching',
        context_data: {
          domain: 'dating',
          goals: ['improve_confidence'],
          mood: 'nervous',
          topic: 'first_date',
        },
      };

      // Act
      const response = await request(client)
        .post('/api/v1/hugo-ai/sessions')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`)
        .set('Content-Type', 'application/json')
        .send(validRequest);

      // Assert - Exact OpenAPI schema compliance
      expect(response.status).toBe(201);
      const body = response.body;

      // Required fields per OpenAPI spec
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('user_id');
      expect(body).toHaveProperty('app_id');
      expect(body).toHaveProperty('session_type');
      expect(body).toHaveProperty('started_at');
      expect(body).toHaveProperty('message_count');

      // Type validation per OpenAPI spec
      expect(typeof body.id).toBe('string');
      expect(body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(typeof body.user_id).toBe('string');
      expect(body.user_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      expect(typeof body.app_id).toBe('string');
      expect(body.app_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      expect(['chat', 'analysis', 'coaching', 'practice']).toContain(body.session_type);
      expect(typeof body.started_at).toBe('string');
      expect(new Date(body.started_at).getTime()).not.toBeNaN(); // Valid timestamp
      expect(typeof body.message_count).toBe('number');

      // Optional fields validation when present
      if (body.ended_at !== null && body.ended_at !== undefined) {
        expect(typeof body.ended_at).toBe('string');
        expect(new Date(body.ended_at).getTime()).not.toBeNaN(); // Valid timestamp
      }

      if (body.duration_seconds !== null && body.duration_seconds !== undefined) {
        expect(typeof body.duration_seconds).toBe('number');
      }

      if (body.context_data) {
        expect(typeof body.context_data).toBe('object');
      }

      if (body.insights_generated) {
        expect(Array.isArray(body.insights_generated)).toBe(true);
      }

      if (body.quality_score !== null && body.quality_score !== undefined) {
        expect(typeof body.quality_score).toBe('number');
        expect(body.quality_score).toBeGreaterThanOrEqual(0);
        expect(body.quality_score).toBeLessThanOrEqual(100);
      }

      registerForCleanup('hugo_ai', 'sessions', body.id);
    });

    it('should return error matching OpenAPI Error schema', async () => {
      // Arrange - Invalid request to trigger error
      const invalidRequest = {
        user_id: testUserId,
        session_type: 'invalid_type',
      };

      // Act
      const response = await request(client)
        .post('/api/v1/hugo-ai/sessions')
        .set('X-App-ID', 'hugo_love')
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
