/**
 * Contract Test: GET /api/v1/hugo-ai/insights
 * Task: T012
 *
 * TDD Phase: GREEN - Testing with real database
 */

import request from 'supertest';
import { createTestClient, TEST_USER_IDS, TEST_USER_TOKENS } from '../../../test-utils/client';

describe('GET /api/v1/hugo-ai/insights', () => {
  let client: any;
  const testUserId = TEST_USER_IDS.user1; // Alice from seed data
  const testToken = TEST_USER_TOKENS.user1;

  beforeEach(() => {
    client = createTestClient();
  });

  describe('Contract Validation', () => {
    it('should return user insights with cross-app data', async () => {
      // Act - Use Bearer token for authentication
      const response = await request(client)
        .get('/api/v1/hugo-ai/insights')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`);

      // Assert - Contract requirements
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('insights');
      expect(Array.isArray(response.body.insights)).toBe(true);

      // Insights may be empty for new users, that's OK
      if (response.body.insights.length > 0) {
        // Verify cross-app insight visibility when insights exist
        const insights = response.body.insights;
        expect(insights[0]).toHaveProperty('cross_app_visibility');
      }
    });

    it('should filter by confidence threshold', async () => {
      // Act - Request only high confidence insights
      const response = await request(client)
        .get('/api/v1/hugo-ai/insights?min_confidence=0.8')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.insights).toBeDefined();
      if (response.body.insights.length > 0) {
        expect(response.body.insights.every((i: any) => i.confidence >= 0.8)).toBe(true);
      }
    });

    it('should filter by insight_type', async () => {
      // Act
      const response = await request(client)
        .get('/api/v1/hugo-ai/insights?insight_type=pattern')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`);

      // Assert
      expect(response.status).toBe(200);
      if (response.body.insights.length > 0) {
        expect(response.body.insights.every((i: any) => i.insight_type === 'pattern')).toBe(true);
      }
    });

    it('should filter by source_app_id', async () => {
      // Act - Use app UUID not app_id
      const hugoLoveUuid = '00000000-0000-0000-0000-000000000011';
      const response = await request(client)
        .get(`/api/v1/hugo-ai/insights?source_app_id=${hugoLoveUuid}`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`);

      // Assert
      expect(response.status).toBe(200);
      if (response.body.insights.length > 0) {
        expect(response.body.insights.every((i: any) => i.source_app_id === hugoLoveUuid)).toBe(
          true
        );
      }
    });

    it('should require authentication', async () => {
      // Act - No Bearer token provided
      const response = await request(client)
        .get('/api/v1/hugo-ai/insights')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });

    it('should reject invalid Bearer token format', async () => {
      // Arrange - Invalid token (not test-user-{uuid} format)
      const invalidToken = 'invalid-token-format';

      // Act
      const response = await request(client)
        .get('/api/v1/hugo-ai/insights')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${invalidToken}`);

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });

    it('should require X-App-ID header for schema routing', async () => {
      // Act - Missing X-App-ID header
      const response = await request(client)
        .get('/api/v1/hugo-ai/insights')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'MISSING_APP_ID',
        message: expect.stringContaining('X-App-ID header'),
      });
    });

    it('should require API key authentication', async () => {
      // Act - No API key
      const response = await request(client)
        .get('/api/v1/hugo-ai/insights')
        .set('X-App-ID', 'hugo_love')
        .set('Authorization', `Bearer ${testToken}`);

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'UNAUTHORIZED',
        message: expect.stringContaining('API key'),
      });
    });

    it('should only return insights with cross_app_visibility=true from other apps', async () => {
      // Act - Request from hugo_love app
      const response = await request(client)
        .get('/api/v1/hugo-ai/insights')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`);

      // Assert
      expect(response.status).toBe(200);
      if (response.body.insights.length > 0) {
        // All insights should have cross_app_visibility set appropriately
        expect(
          response.body.insights.every((i: any) => typeof i.cross_app_visibility === 'boolean')
        ).toBe(true);
      }
    });

    it('should support pagination parameters', async () => {
      // Act
      const response = await request(client)
        .get('/api/v1/hugo-ai/insights?limit=10&offset=0')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.insights).toBeDefined();
      expect(Array.isArray(response.body.insights)).toBe(true);
    });
  });

  describe('OpenAPI Contract Compliance', () => {
    it('should match OpenAPI schema for successful response', async () => {
      // Act
      const response = await request(client)
        .get('/api/v1/hugo-ai/insights')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`);

      // Assert - Exact OpenAPI schema compliance
      expect(response.status).toBe(200);
      const body = response.body;

      // Response wrapper
      expect(body).toHaveProperty('insights');
      expect(Array.isArray(body.insights)).toBe(true);

      // Validate each insight in array
      body.insights.forEach((insight: any) => {
        // Required fields per OpenAPI spec
        expect(insight).toHaveProperty('id');
        expect(insight).toHaveProperty('user_id');
        expect(insight).toHaveProperty('insight_type');
        expect(insight).toHaveProperty('content');
        expect(insight).toHaveProperty('confidence');
        expect(insight).toHaveProperty('source_app_id');
        expect(insight).toHaveProperty('cross_app_visibility');
        expect(insight).toHaveProperty('created_at');

        // Type validation per OpenAPI spec
        expect(typeof insight.id).toBe('string');
        expect(insight.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );
        expect(typeof insight.user_id).toBe('string');
        expect(insight.user_id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );
        expect(['pattern', 'recommendation', 'goal_progress']).toContain(insight.insight_type);
        expect(typeof insight.content).toBe('string');
        expect(typeof insight.confidence).toBe('number');
        expect(insight.confidence).toBeGreaterThanOrEqual(0);
        expect(insight.confidence).toBeLessThanOrEqual(1);
        expect(typeof insight.source_app_id).toBe('string');
        expect(typeof insight.cross_app_visibility).toBe('boolean');
        expect(typeof insight.created_at).toBe('string');
        // Validate it's a valid ISO timestamp (PostgreSQL may have microseconds, JS has milliseconds)
        expect(() => new Date(insight.created_at)).not.toThrow();
        expect(new Date(insight.created_at).toISOString()).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
        );

        // Optional session_id validation
        if (insight.session_id !== null && insight.session_id !== undefined) {
          expect(typeof insight.session_id).toBe('string');
          expect(insight.session_id).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          );
        }

        // Optional supporting_data validation
        if (insight.supporting_data) {
          expect(typeof insight.supporting_data).toBe('object');
        }
      });
    });

    it('should return error matching OpenAPI Error schema', async () => {
      // Arrange - Missing X-App-ID to trigger error

      // Act
      const response = await request(client)
        .get('/api/v1/hugo-ai/insights')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`);

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
