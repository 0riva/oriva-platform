/**
 * Contract Test: POST /api/v1/apps/profiles
 * Task: T013
 *
 * TDD Phase: GREEN - Testing with real database
 */

import request from 'supertest';
import { createTestClient, TEST_USER_TOKENS } from '../../../test-utils/client';
import { cleanupRegisteredData, registerForCleanup } from '../../../test-utils/transactions';

describe('POST /api/v1/apps/profiles', () => {
  let client: any;
  const testToken = TEST_USER_TOKENS.user1; // Alice
  const testUserId = '00000000-0000-0000-0000-000000000001'; // Alice's user ID

  beforeEach(async () => {
    client = createTestClient();

    // Delete Alice's existing profile to allow POST tests
    const { createTestDatabase } = require('../../../test-utils/database');
    const db = createTestDatabase();
    await db.schema('hugo_love').from('profiles').delete().eq('user_id', testUserId);
  });

  afterEach(async () => {
    await cleanupRegisteredData();
  });

  describe('Contract Validation - Hugo Love Dating Profiles', () => {
    it('should create a hugo_love dating profile', async () => {
      // Arrange
      const validRequest = {
        user_id: testUserId,
        profile_data: {
          age: 28,
          gender: 'male',
          looking_for: 'female',
          bio: 'Love hiking and trying new restaurants',
          interests: ['hiking', 'cooking', 'travel', 'photography'],
          relationship_goals: 'long-term',
          location: {
            city: 'San Francisco',
            state: 'CA',
            country: 'USA',
          },
          dating_preferences: {
            age_range: {
              min: 25,
              max: 35,
            },
            distance_max_miles: 25,
            dealbreakers: ['smoking'],
          },
        },
      };

      // Act
      const response = await request(client)
        .post('/api/v1/apps/profiles')
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
        profile_data: expect.objectContaining({
          age: 28,
          gender: 'male',
          interests: expect.arrayContaining(['hiking', 'cooking']),
        }),
      });

      // Register for cleanup
      registerForCleanup('hugo_love', 'profiles', response.body.id);
    });

    it('should store profile in app-specific schema (hugo_love)', async () => {
      // Arrange
      const validRequest = {
        user_id: testUserId,
        profile_data: {
          age: 30,
          gender: 'female',
          bio: 'Software engineer who loves dogs',
        },
      };

      // Act
      const response = await request(client)
        .post('/api/v1/apps/profiles')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`)
        .set('Content-Type', 'application/json')
        .send(validRequest);

      // Assert - Should use hugo_love schema and return correct data
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.profile_data).toMatchObject({
        age: 30,
        gender: 'female',
      });

      // Register for cleanup
      registerForCleanup('hugo_love', 'profiles', response.body.id);
    });

    it('should require user_id field', async () => {
      // Arrange
      const invalidRequest = {
        profile_data: {
          age: 28,
          gender: 'male',
        },
      };

      // Act
      const response = await request(client)
        .post('/api/v1/apps/profiles')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`)
        .set('Content-Type', 'application/json')
        .send(invalidRequest);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: expect.stringContaining('user_id'),
      });
    });

    it('should require profile_data field', async () => {
      // Arrange
      const invalidRequest = {
        user_id: testUserId,
      };

      // Act
      const response = await request(client)
        .post('/api/v1/apps/profiles')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`)
        .set('Content-Type', 'application/json')
        .send(invalidRequest);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: expect.stringContaining('profile_data'),
      });
    });

    it('should require X-App-ID header for schema routing', async () => {
      // Arrange
      const validRequest = {
        user_id: testUserId,
        profile_data: {
          age: 28,
          gender: 'male',
        },
      };

      // Act - Missing X-App-ID header
      const response = await request(client)
        .post('/api/v1/apps/profiles')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`)
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
        profile_data: {
          age: 28,
          gender: 'male',
        },
      };

      // Act - No API key
      const response = await request(client)
        .post('/api/v1/apps/profiles')
        .set('X-App-ID', 'hugo_love')
        .set('Authorization', `Bearer ${testToken}`)
        .set('Content-Type', 'application/json')
        .send(validRequest);

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'UNAUTHORIZED',
        message: expect.stringContaining('API key'),
      });
    });

    it('should validate user_id UUID format', async () => {
      // Arrange
      const invalidRequest = {
        user_id: 'not-a-uuid',
        profile_data: {
          age: 28,
          gender: 'male',
        },
      };

      // Act
      const response = await request(client)
        .post('/api/v1/apps/profiles')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`)
        .set('Content-Type', 'application/json')
        .send(invalidRequest);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'INVALID_USER_ID',
        message: expect.stringContaining('Invalid user ID format'),
      });
    });

    it('should prevent duplicate profiles for same user', async () => {
      // Arrange - Create first profile
      const profileRequest = {
        user_id: testUserId,
        profile_data: {
          age: 28,
          gender: 'male',
        },
      };

      const firstResponse = await request(client)
        .post('/api/v1/apps/profiles')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`)
        .set('Content-Type', 'application/json')
        .send(profileRequest);

      registerForCleanup('hugo_love', 'profiles', firstResponse.body.id);

      // Act - Try to create duplicate
      const response = await request(client)
        .post('/api/v1/apps/profiles')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`)
        .set('Content-Type', 'application/json')
        .send(profileRequest);

      // Assert
      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        code: 'PROFILE_EXISTS',
        message: expect.stringContaining('already exists'),
      });
    });

    it('should accept JSONB profile_data structure', async () => {
      // Arrange - Complex nested profile data
      const complexRequest = {
        user_id: testUserId,
        profile_data: {
          age: 32,
          gender: 'non-binary',
          pronouns: 'they/them',
          bio: 'Artist and musician',
          interests: ['art', 'music', 'philosophy'],
          personality_traits: {
            openness: 0.85,
            conscientiousness: 0.72,
            extraversion: 0.68,
            agreeableness: 0.91,
            emotional_stability: 0.78,
          },
          communication_style: {
            preferred_response_time: 'within_hours',
            conversation_depth: 'deep',
            humor_style: 'witty',
          },
          relationship_goals: 'exploring',
          photos: [
            {
              url: 'https://example.com/photo1.jpg',
              order: 1,
              is_primary: true,
            },
          ],
        },
      };

      // Act
      const response = await request(client)
        .post('/api/v1/apps/profiles')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testToken}`)
        .set('Content-Type', 'application/json')
        .send(complexRequest);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.profile_data).toMatchObject({
        personality_traits: expect.any(Object),
        communication_style: expect.any(Object),
        photos: expect.any(Array),
      });

      // Register for cleanup
      registerForCleanup('hugo_love', 'profiles', response.body.id);
    });
  });

  describe('Contract Validation - Hugo Career Profiles', () => {
    it('should create a hugo_career professional profile', async () => {
      // Use user2 (Bob) who has access to hugo_career
      const testTokenUser2 = TEST_USER_TOKENS.user2;
      const testUserIdBob = '00000000-0000-0000-0000-000000000002';

      // Arrange
      const careerProfile = {
        user_id: testUserIdBob,
        profile_data: {
          current_role: 'Software Engineer',
          current_company: 'Tech Corp',
          years_experience: 5,
          skills: ['JavaScript', 'TypeScript', 'React', 'Node.js'],
          career_goals: ['senior_engineer', 'tech_lead'],
          industries: ['technology', 'fintech'],
          education: [
            {
              degree: 'BS Computer Science',
              institution: 'University of California',
              year: 2018,
            },
          ],
          certifications: ['AWS Certified Solutions Architect'],
          looking_for: 'career_advancement',
        },
      };

      // Act
      const response = await request(client)
        .post('/api/v1/apps/profiles')
        .set('X-App-ID', 'hugo_career')
        .set('X-API-Key', 'test-api-key')
        .set('Authorization', `Bearer ${testTokenUser2}`)
        .set('Content-Type', 'application/json')
        .send(careerProfile);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.profile_data).toMatchObject({
        current_role: 'Software Engineer',
        skills: expect.arrayContaining(['JavaScript', 'TypeScript']),
        career_goals: expect.arrayContaining(['senior_engineer']),
      });

      // Register for cleanup
      registerForCleanup('hugo_career', 'profiles', response.body.id);
    });
  });

  describe('OpenAPI Contract Compliance', () => {
    it('should match OpenAPI schema for successful response', async () => {
      // Arrange
      const validRequest = {
        user_id: testUserId,
        profile_data: {
          age: 29,
          gender: 'female',
          bio: 'Love outdoor adventures',
          interests: ['hiking', 'camping'],
        },
      };

      // Act
      const response = await request(client)
        .post('/api/v1/apps/profiles')
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
      expect(body).toHaveProperty('profile_data');
      expect(body).toHaveProperty('created_at');
      expect(body).toHaveProperty('updated_at');

      // Type validation per OpenAPI spec
      expect(typeof body.id).toBe('string');
      expect(body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(typeof body.user_id).toBe('string');
      expect(body.user_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      expect(typeof body.profile_data).toBe('object');
      expect(typeof body.created_at).toBe('string');
      expect(typeof body.updated_at).toBe('string');

      // Validate it's a valid ISO timestamp
      expect(() => new Date(body.created_at)).not.toThrow();
      expect(() => new Date(body.updated_at)).not.toThrow();

      // Register for cleanup
      registerForCleanup('hugo_love', 'profiles', body.id);
    });

    it('should return error matching OpenAPI Error schema', async () => {
      // Arrange - Invalid request to trigger error
      const invalidRequest = {
        user_id: 'invalid-uuid',
        profile_data: {
          age: 28,
        },
      };

      // Act
      const response = await request(client)
        .post('/api/v1/apps/profiles')
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
