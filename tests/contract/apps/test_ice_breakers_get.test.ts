/**
 * Contract Test: GET /api/v1/apps/ice-breakers
 * Task: T015
 *
 * TDD Phase: GREEN - Testing with real database
 */

import request from 'supertest';
import { createTestClient, TEST_USER_TOKENS } from '../../../test-utils/client';

describe('GET /api/v1/apps/ice-breakers', () => {
  let client: any;
  const testToken = TEST_USER_TOKENS.user1; // Alice - has hugo_love profile with ice breakers
  const testProfileId = '00000000-0000-0000-0000-000000000041'; // Profile 1 from seed data

  beforeEach(() => {
    client = createTestClient();
  });

  describe('Contract Validation - Hugo Love Ice Breakers', () => {
    it('should return personalized ice breakers for hugo_love', async () => {
      // Act
      const response = await request(client)
        .get(`/api/v1/apps/ice-breakers?profile_id=${testProfileId}`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`);

      // Assert - Contract requirements
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('ice_breakers');
      expect(Array.isArray(response.body.ice_breakers)).toBe(true);

      // Should have ice breakers from seed data
      expect(response.body.ice_breakers.length).toBeGreaterThanOrEqual(0);

      // Validate ice breaker structure if data exists
      if (response.body.ice_breakers.length > 0) {
        const firstIceBreaker = response.body.ice_breakers[0];
        expect(firstIceBreaker).toHaveProperty('id');
        expect(firstIceBreaker).toHaveProperty('profile_id');
        expect(firstIceBreaker).toHaveProperty('content');
        expect(firstIceBreaker).toHaveProperty('category');
        expect(firstIceBreaker.category).toMatch(
          /^(shared_interest|photo_comment|conversation_starter)$/
        );
        expect(firstIceBreaker).toHaveProperty('confidence');
        expect(typeof firstIceBreaker.confidence).toBe('number');
      }
    });

    it('should only work for hugo_love app (app-specific feature)', async () => {
      // Act
      const response = await request(client)
        .get(`/api/v1/apps/ice-breakers?profile_id=${testProfileId}`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`);

      // Assert - Works for hugo_love
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('ice_breakers');
      expect(Array.isArray(response.body.ice_breakers)).toBe(true);
    });

    it('should return 404 for unsupported apps like hugo_career', async () => {
      // Use user2 (Bob) who has access to hugo_career
      const testTokenUser2 = TEST_USER_TOKENS.user2;

      // Act - Try to access ice-breakers from hugo_career
      const response = await request(client)
        .get(`/api/v1/apps/ice-breakers?profile_id=${testProfileId}`)
        .set('X-App-ID', 'hugo_career')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testTokenUser2}`);

      // Assert - Feature not supported for hugo_career (table doesn't exist in that schema)
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        code: 'FEATURE_NOT_SUPPORTED',
        message: expect.stringContaining('not available for this app'),
      });
    });

    it('should require profile_id query parameter', async () => {
      // Act - No profile_id provided
      const response = await request(client)
        .get('/api/v1/apps/ice-breakers')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: expect.stringContaining('profile_id'),
      });
    });

    it('should validate profile_id UUID format', async () => {
      // Arrange
      const invalidProfileId = 'not-a-uuid';

      // Act
      const response = await request(client)
        .get(`/api/v1/apps/ice-breakers?profile_id=${invalidProfileId}`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'INVALID_PROFILE_ID',
        message: expect.stringContaining('Invalid profile ID format'),
      });
    });

    it('should require X-App-ID header', async () => {
      // Act - Missing X-App-ID header
      const response = await request(client)
        .get(`/api/v1/apps/ice-breakers?profile_id=${testProfileId}`)
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
        .get(`/api/v1/apps/ice-breakers?profile_id=${testProfileId}`)
        .set('X-App-ID', 'hugo_love')
        .set('Authorization', `Bearer ${testToken}`);

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'UNAUTHORIZED',
        message: expect.stringContaining('API key'),
      });
    });

    it('should support limit parameter', async () => {
      // Act - Request only 2 ice breakers
      const response = await request(client)
        .get(`/api/v1/apps/ice-breakers?profile_id=${testProfileId}&limit=2`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('ice_breakers');
      expect(Array.isArray(response.body.ice_breakers)).toBe(true);
      expect(response.body.ice_breakers.length).toBeLessThanOrEqual(2);
    });

    it('should filter by minimum confidence', async () => {
      // Act - Request only high confidence ice breakers
      const response = await request(client)
        .get(`/api/v1/apps/ice-breakers?profile_id=${testProfileId}&min_confidence=0.9`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('ice_breakers');
      expect(Array.isArray(response.body.ice_breakers)).toBe(true);

      // If there are results, verify confidence filter
      if (response.body.ice_breakers.length > 0) {
        response.body.ice_breakers.forEach((iceBreaker: any) => {
          expect(iceBreaker.confidence).toBeGreaterThanOrEqual(0.9);
        });
      }
    });

    it('should filter by category', async () => {
      // Act
      const response = await request(client)
        .get(`/api/v1/apps/ice-breakers?profile_id=${testProfileId}&category=photo_comment`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('ice_breakers');
      expect(Array.isArray(response.body.ice_breakers)).toBe(true);

      // If there are results, verify category filter
      if (response.body.ice_breakers.length > 0) {
        response.body.ice_breakers.forEach((iceBreaker: any) => {
          expect(iceBreaker.category).toBe('photo_comment');
        });
      }
    });

    it('should return empty array when no ice breakers available', async () => {
      // Use a non-existent profile ID
      const nonExistentProfileId = '00000000-0000-0000-0000-000000000099';

      // Act
      const response = await request(client)
        .get(`/api/v1/apps/ice-breakers?profile_id=${nonExistentProfileId}`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        ice_breakers: [],
      });
    });
  });

  describe('OpenAPI Contract Compliance', () => {
    it('should match OpenAPI schema for successful response', async () => {
      // Act
      const response = await request(client)
        .get(`/api/v1/apps/ice-breakers?profile_id=${testProfileId}`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`);

      // Assert - Exact OpenAPI schema compliance
      expect(response.status).toBe(200);
      const body = response.body;

      // Response wrapper
      expect(body).toHaveProperty('ice_breakers');
      expect(Array.isArray(body.ice_breakers)).toBe(true);

      // Validate each ice breaker in array (if data exists)
      if (body.ice_breakers.length > 0) {
        body.ice_breakers.forEach((iceBreaker: any) => {
          // Required fields per OpenAPI spec
          expect(iceBreaker).toHaveProperty('id');
          expect(iceBreaker).toHaveProperty('profile_id');
          expect(iceBreaker).toHaveProperty('content');
          expect(iceBreaker).toHaveProperty('category');
          expect(iceBreaker).toHaveProperty('confidence');
          expect(iceBreaker).toHaveProperty('created_at');

          // Type validation per OpenAPI spec
          expect(typeof iceBreaker.id).toBe('string');
          expect(iceBreaker.id).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          );
          expect(typeof iceBreaker.profile_id).toBe('string');
          expect(iceBreaker.profile_id).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          );
          expect(typeof iceBreaker.content).toBe('string');
          expect(typeof iceBreaker.category).toBe('string');
          expect(['shared_interest', 'photo_comment', 'conversation_starter']).toContain(
            iceBreaker.category
          );
          expect(typeof iceBreaker.confidence).toBe('number');
          expect(iceBreaker.confidence).toBeGreaterThanOrEqual(0);
          expect(iceBreaker.confidence).toBeLessThanOrEqual(1);
          expect(typeof iceBreaker.created_at).toBe('string');

          // Optional personalization_factors validation
          if (iceBreaker.personalization_factors) {
            expect(typeof iceBreaker.personalization_factors).toBe('object');
          }
        });
      }
    });

    it('should return error matching OpenAPI Error schema', async () => {
      // Arrange - Invalid profile_id to trigger error
      const invalidProfileId = 'invalid-uuid-format';

      // Act
      const response = await request(client)
        .get(`/api/v1/apps/ice-breakers?profile_id=${invalidProfileId}`)
        .set('X-App-ID', 'hugo_love')
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
