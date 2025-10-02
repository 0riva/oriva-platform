/**
 * Contract Test: GET /api/v1/apps/profiles
 * Task: T014
 *
 * TDD Phase: RED - Test written before implementation
 * This test MUST fail initially before implementation
 */

import request from 'supertest';
import { createTestClient } from '../../../test-utils/client';
import { mockSupabase } from '../../../test-utils/supabase';

describe('GET /api/v1/apps/profiles', () => {
  let client: any;
  const testUserId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    jest.clearAllMocks();
    client = createTestClient();
  });

  describe('Contract Validation - Hugo Love Profiles', () => {
    it('should retrieve dating profile from hugo_love schema', async () => {
      // Arrange
      const mockProfile = {
        id: 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e',
        user_id: testUserId,
        app_id: 'hugo_love',
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
        created_at: '2025-01-02T15:00:00Z',
        updated_at: '2025-01-02T16:00:00Z',
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .get(`/api/v1/apps/profiles?user_id=${testUserId}`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key');

      // Assert - Contract requirements
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: expect.any(String),
        user_id: testUserId,
        app_id: 'hugo_love',
        profile_data: expect.objectContaining({
          age: 28,
          gender: 'male',
          interests: expect.arrayContaining(['hiking']),
        }),
      });
    });

    it('should query from app-specific schema based on X-App-ID', async () => {
      // Arrange
      const mockProfile = {
        id: 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e',
        user_id: testUserId,
        app_id: 'hugo_love',
        profile_data: {
          age: 30,
          gender: 'female',
        },
        created_at: '2025-01-02T15:00:00Z',
        updated_at: '2025-01-02T16:00:00Z',
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .get(`/api/v1/apps/profiles?user_id=${testUserId}`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.app_id).toBe('hugo_love');
      // Implementation should have set schema search path to hugo_love
    });

    it('should require user_id query parameter', async () => {
      // Act - No user_id provided
      const response = await request(client)
        .get('/api/v1/apps/profiles')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: expect.stringContaining('user_id'),
      });
    });

    it('should validate user_id UUID format', async () => {
      // Arrange
      const invalidUserId = 'not-a-uuid';

      // Act
      const response = await request(client)
        .get(`/api/v1/apps/profiles?user_id=${invalidUserId}`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'INVALID_USER_ID',
        message: expect.stringContaining('Invalid user ID format'),
      });
    });

    it('should return 404 for non-existent profile', async () => {
      // Arrange
      const nonExistentUserId = '999e8400-e29b-41d4-a716-446655440999';

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: {
                code: 'PGRST116',
                message: 'The result contains 0 rows',
              },
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .get(`/api/v1/apps/profiles?user_id=${nonExistentUserId}`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        code: 'PROFILE_NOT_FOUND',
        message: expect.stringContaining('Profile not found'),
      });
    });

    it('should require X-App-ID header for schema routing', async () => {
      // Act - Missing X-App-ID header
      const response = await request(client)
        .get(`/api/v1/apps/profiles?user_id=${testUserId}`)
        .set('X-API-Key', 'test-api-key');

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
        .get(`/api/v1/apps/profiles?user_id=${testUserId}`)
        .set('X-App-ID', 'hugo_love');

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'UNAUTHORIZED',
        message: expect.stringContaining('API key'),
      });
    });

    it('should return complex JSONB profile_data structure', async () => {
      // Arrange - Complex nested profile data
      const mockProfile = {
        id: 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e',
        user_id: testUserId,
        app_id: 'hugo_love',
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
            {
              url: 'https://example.com/photo2.jpg',
              order: 2,
              is_primary: false,
            },
          ],
        },
        created_at: '2025-01-02T15:00:00Z',
        updated_at: '2025-01-02T16:00:00Z',
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .get(`/api/v1/apps/profiles?user_id=${testUserId}`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.profile_data).toMatchObject({
        personality_traits: expect.objectContaining({
          openness: 0.85,
          agreeableness: 0.91,
        }),
        communication_style: expect.objectContaining({
          preferred_response_time: 'within_hours',
        }),
        photos: expect.arrayContaining([
          expect.objectContaining({
            url: expect.stringContaining('photo1.jpg'),
            is_primary: true,
          }),
        ]),
      });
    });
  });

  describe('Contract Validation - Hugo Career Profiles', () => {
    it('should retrieve professional profile from hugo_career schema', async () => {
      // Arrange
      const mockProfile = {
        id: 'd4b5f8e9-f0c2-5d3b-9g6f-2c4e6g8b0d3f',
        user_id: testUserId,
        app_id: 'hugo_career',
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
        created_at: '2025-01-02T15:00:00Z',
        updated_at: '2025-01-02T16:00:00Z',
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .get(`/api/v1/apps/profiles?user_id=${testUserId}`)
        .set('X-App-ID', 'hugo_career')
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.app_id).toBe('hugo_career');
      expect(response.body.profile_data).toMatchObject({
        current_role: 'Software Engineer',
        skills: expect.arrayContaining(['JavaScript', 'TypeScript']),
        career_goals: expect.arrayContaining(['senior_engineer']),
      });
    });

    it('should isolate profiles between apps', async () => {
      // Arrange - User has profile in hugo_love but requesting from hugo_career
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: {
                code: 'PGRST116',
                message: 'The result contains 0 rows',
              },
            }),
          }),
        }),
      });

      // Act - Request from hugo_career when profile only exists in hugo_love
      const response = await request(client)
        .get(`/api/v1/apps/profiles?user_id=${testUserId}`)
        .set('X-App-ID', 'hugo_career')
        .set('X-API-Key', 'test-api-key');

      // Assert - Should not find profile (schema isolation)
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        code: 'PROFILE_NOT_FOUND',
      });
    });
  });

  describe('OpenAPI Contract Compliance', () => {
    it('should match OpenAPI schema for successful response', async () => {
      // Arrange
      const mockProfile = {
        id: 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e',
        user_id: testUserId,
        app_id: 'hugo_love',
        profile_data: {
          age: 29,
          gender: 'female',
          bio: 'Love outdoor adventures',
          interests: ['hiking', 'camping'],
          location: {
            city: 'Denver',
            state: 'CO',
          },
        },
        created_at: '2025-01-02T15:00:00Z',
        updated_at: '2025-01-02T16:00:00Z',
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .get(`/api/v1/apps/profiles?user_id=${testUserId}`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key');

      // Assert - Exact OpenAPI schema compliance
      expect(response.status).toBe(200);
      const body = response.body;

      // Required fields per OpenAPI spec
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('user_id');
      expect(body).toHaveProperty('app_id');
      expect(body).toHaveProperty('profile_data');
      expect(body).toHaveProperty('created_at');
      expect(body).toHaveProperty('updated_at');

      // Type validation per OpenAPI spec
      expect(typeof body.id).toBe('string');
      expect(body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(typeof body.user_id).toBe('string');
      expect(body.user_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(typeof body.app_id).toBe('string');
      expect(typeof body.profile_data).toBe('object');
      expect(typeof body.created_at).toBe('string');
      expect(new Date(body.created_at).toISOString()).toBe(body.created_at);
      expect(typeof body.updated_at).toBe('string');
      expect(new Date(body.updated_at).toISOString()).toBe(body.updated_at);

      // profile_data is JSONB and can contain any valid JSON structure
      expect(body.profile_data).toBeDefined();
    });

    it('should return error matching OpenAPI Error schema', async () => {
      // Arrange - Invalid user_id to trigger error
      const invalidUserId = 'invalid-uuid-format';

      // Act
      const response = await request(client)
        .get(`/api/v1/apps/profiles?user_id=${invalidUserId}`)
        .set('X-App-ID', 'hugo_love')
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
