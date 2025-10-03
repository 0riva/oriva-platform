/**
 * Contract Test: GET /api/v1/apps/profiles
 * Task: T014
 *
 * TDD Phase: GREEN - Testing with real database
 */

import request from 'supertest';
import { createTestClient, TEST_USER_TOKENS } from '../../../test-utils/client';

describe('GET /api/v1/apps/profiles', () => {
  let client: any;
  const testTokenUser1 = TEST_USER_TOKENS.user1; // Alice - has access to hugo_love only
  const testTokenUser2 = TEST_USER_TOKENS.user2; // Bob - has access to both apps

  beforeEach(() => {
    client = createTestClient();
  });

  describe('Contract Validation - Hugo Love Profiles', () => {
    it('should list dating profiles from hugo_love schema', async () => {
      // Act
      const response = await request(client)
        .get('/api/v1/apps/profiles')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testTokenUser1}`);

      // Assert - Contract requirements
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('profiles');
      expect(Array.isArray(response.body.profiles)).toBe(true);

      // Should have at least 2 profiles from seed data
      expect(response.body.profiles.length).toBeGreaterThanOrEqual(2);

      // Validate structure of first profile
      if (response.body.profiles.length > 0) {
        const profile = response.body.profiles[0];
        expect(profile).toHaveProperty('id');
        expect(profile).toHaveProperty('user_id');
        expect(profile).toHaveProperty('profile_data');
        expect(typeof profile.profile_data).toBe('object');
      }
    });

    it('should support pagination parameters', async () => {
      // Act
      const response = await request(client)
        .get('/api/v1/apps/profiles?limit=1&offset=0')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testTokenUser1}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.profiles).toBeDefined();
      expect(Array.isArray(response.body.profiles)).toBe(true);
      expect(response.body.profiles.length).toBeLessThanOrEqual(1);
    });

    it('should require X-App-ID header for schema routing', async () => {
      // Act - Missing X-App-ID header
      const response = await request(client)
        .get('/api/v1/apps/profiles')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testTokenUser1}`);

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
        .get('/api/v1/apps/profiles')
        .set('X-App-ID', 'hugo_love')
        .set('Authorization', `Bearer ${testTokenUser1}`);

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'UNAUTHORIZED',
        message: expect.stringContaining('API key'),
      });
    });

    it('should return JSONB profile_data structures', async () => {
      // Act
      const response = await request(client)
        .get('/api/v1/apps/profiles')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testTokenUser1}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.profiles).toBeDefined();

      // Check that profiles have JSONB profile_data
      if (response.body.profiles.length > 0) {
        const profile = response.body.profiles[0];
        expect(profile.profile_data).toBeDefined();
        expect(typeof profile.profile_data).toBe('object');

        // Seed data has age, bio, gender, location, interests
        expect(profile.profile_data).toHaveProperty('age');
        expect(profile.profile_data).toHaveProperty('bio');
      }
    });
  });

  describe('Contract Validation - Hugo Career Profiles', () => {
    it('should list profiles from hugo_career schema', async () => {
      // Act - Use user2 who has access to hugo_career
      const response = await request(client)
        .get('/api/v1/apps/profiles')
        .set('X-App-ID', 'hugo_career')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testTokenUser2}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('profiles');
      expect(Array.isArray(response.body.profiles)).toBe(true);

      // hugo_career has 0 profiles in seed data
      expect(response.body.profiles.length).toBe(0);
    });

    it('should isolate profiles between apps', async () => {
      // Arrange - Use user2 who has access to both apps
      // hugo_love has 2 profiles, hugo_career has 0
      const hugoLoveResponse = await request(client)
        .get('/api/v1/apps/profiles')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testTokenUser2}`);

      const hugoCareerResponse = await request(client)
        .get('/api/v1/apps/profiles')
        .set('X-App-ID', 'hugo_career')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testTokenUser2}`);

      // Assert - Schema isolation
      expect(hugoLoveResponse.status).toBe(200);
      expect(hugoLoveResponse.body.profiles.length).toBeGreaterThanOrEqual(2);

      expect(hugoCareerResponse.status).toBe(200);
      expect(hugoCareerResponse.body.profiles.length).toBe(0);
    });
  });

  describe('OpenAPI Contract Compliance', () => {
    it('should match OpenAPI schema for successful response', async () => {
      // Act
      const response = await request(client)
        .get('/api/v1/apps/profiles')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testTokenUser1}`);

      // Assert - Exact OpenAPI schema compliance
      expect(response.status).toBe(200);
      const body = response.body;

      // Response wrapper
      expect(body).toHaveProperty('profiles');
      expect(Array.isArray(body.profiles)).toBe(true);

      // Validate each profile in array
      body.profiles.forEach((profile: any) => {
        // Required fields per OpenAPI spec
        expect(profile).toHaveProperty('id');
        expect(profile).toHaveProperty('user_id');
        expect(profile).toHaveProperty('profile_data');
        expect(profile).toHaveProperty('created_at');
        expect(profile).toHaveProperty('updated_at');

        // Type validation per OpenAPI spec
        expect(typeof profile.id).toBe('string');
        expect(profile.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );
        expect(typeof profile.user_id).toBe('string');
        expect(profile.user_id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );
        expect(typeof profile.profile_data).toBe('object');
        expect(typeof profile.created_at).toBe('string');
        expect(typeof profile.updated_at).toBe('string');

        // Validate it's a valid ISO timestamp (PostgreSQL may have microseconds)
        expect(() => new Date(profile.created_at)).not.toThrow();
        expect(() => new Date(profile.updated_at)).not.toThrow();
      });
    });

    it('should return error matching OpenAPI Error schema', async () => {
      // Arrange - Missing X-App-ID to trigger error

      // Act
      const response = await request(client)
        .get('/api/v1/apps/profiles')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testTokenUser1}`);

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
