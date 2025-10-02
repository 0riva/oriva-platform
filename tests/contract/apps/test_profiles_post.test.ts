/**
 * Contract Test: POST /api/v1/apps/profiles
 * Task: T013
 *
 * TDD Phase: RED - Test written before implementation
 * This test MUST fail initially before implementation
 */

import request from 'supertest';
import { createTestClient } from '../../../test-utils/client';
import { mockSupabase } from '../../../test-utils/supabase';

describe('POST /api/v1/apps/profiles', () => {
  let client: any;

  beforeEach(() => {
    jest.clearAllMocks();
    client = createTestClient();
  });

  describe('Contract Validation - Hugo Love Dating Profiles', () => {
    it('should create a hugo_love dating profile', async () => {
      // Arrange
      const validRequest = {
        user_id: '550e8400-e29b-41d4-a716-446655440000',
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

      const mockProfile = {
        id: 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e',
        user_id: validRequest.user_id,
        app_id: 'hugo_love',
        profile_data: validRequest.profile_data,
        created_at: '2025-01-02T16:30:00Z',
        updated_at: '2025-01-02T16:30:00Z',
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .post('/api/v1/apps/profiles')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(validRequest);

      // Assert - Contract requirements
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: expect.any(String),
        user_id: validRequest.user_id,
        app_id: 'hugo_love',
        profile_data: expect.objectContaining({
          age: 28,
          gender: 'male',
          interests: expect.arrayContaining(['hiking', 'cooking']),
        }),
      });
    });

    it('should store profile in app-specific schema (hugo_love)', async () => {
      // Arrange
      const validRequest = {
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        profile_data: {
          age: 30,
          gender: 'female',
          bio: 'Software engineer who loves dogs',
        },
      };

      let calledSchema = '';
      mockSupabase.from.mockImplementation((table: string) => {
        // Capture which table/schema was called
        calledSchema = table;
        return {
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e',
                  ...validRequest,
                  app_id: 'hugo_love',
                  created_at: '2025-01-02T16:30:00Z',
                  updated_at: '2025-01-02T16:30:00Z',
                },
                error: null,
              }),
            }),
          }),
        };
      });

      // Act
      const response = await request(client)
        .post('/api/v1/apps/profiles')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(validRequest);

      // Assert - Should use hugo_love schema
      expect(response.status).toBe(201);
      expect(response.body.app_id).toBe('hugo_love');
      // Implementation should have set schema path to hugo_love
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
        user_id: '550e8400-e29b-41d4-a716-446655440000',
      };

      // Act
      const response = await request(client)
        .post('/api/v1/apps/profiles')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
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
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        profile_data: {
          age: 28,
          gender: 'male',
        },
      };

      // Act - Missing X-App-ID header
      const response = await request(client)
        .post('/api/v1/apps/profiles')
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
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        profile_data: {
          age: 28,
          gender: 'male',
        },
      };

      // Act - No API key
      const response = await request(client)
        .post('/api/v1/apps/profiles')
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
      // Arrange
      const duplicateRequest = {
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        profile_data: {
          age: 28,
          gender: 'male',
        },
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: {
                code: '23505', // Unique violation
                message: 'duplicate key value violates unique constraint',
              },
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .post('/api/v1/apps/profiles')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(duplicateRequest);

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
        user_id: '550e8400-e29b-41d4-a716-446655440000',
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

      const mockProfile = {
        id: 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e',
        user_id: complexRequest.user_id,
        app_id: 'hugo_love',
        profile_data: complexRequest.profile_data,
        created_at: '2025-01-02T16:30:00Z',
        updated_at: '2025-01-02T16:30:00Z',
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .post('/api/v1/apps/profiles')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(complexRequest);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.profile_data).toMatchObject({
        personality_traits: expect.any(Object),
        communication_style: expect.any(Object),
        photos: expect.any(Array),
      });
    });
  });

  describe('Contract Validation - Hugo Career Profiles', () => {
    it('should create a hugo_career professional profile', async () => {
      // Arrange
      const careerProfile = {
        user_id: '550e8400-e29b-41d4-a716-446655440000',
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

      const mockProfile = {
        id: 'd4b5f8e9-f0c2-5d3b-9g6f-2c4e6g8b0d3f',
        user_id: careerProfile.user_id,
        app_id: 'hugo_career',
        profile_data: careerProfile.profile_data,
        created_at: '2025-01-02T16:30:00Z',
        updated_at: '2025-01-02T16:30:00Z',
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .post('/api/v1/apps/profiles')
        .set('X-App-ID', 'hugo_career')
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(careerProfile);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.app_id).toBe('hugo_career');
      expect(response.body.profile_data).toMatchObject({
        current_role: 'Software Engineer',
        skills: expect.arrayContaining(['JavaScript', 'TypeScript']),
        career_goals: expect.arrayContaining(['senior_engineer']),
      });
    });
  });

  describe('OpenAPI Contract Compliance', () => {
    it('should match OpenAPI schema for successful response', async () => {
      // Arrange
      const validRequest = {
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        profile_data: {
          age: 29,
          gender: 'female',
          bio: 'Love outdoor adventures',
          interests: ['hiking', 'camping'],
        },
      };

      const mockProfile = {
        id: 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e',
        user_id: validRequest.user_id,
        app_id: 'hugo_love',
        profile_data: validRequest.profile_data,
        created_at: '2025-01-02T16:30:00Z',
        updated_at: '2025-01-02T16:30:00Z',
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .post('/api/v1/apps/profiles')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(validRequest);

      // Assert - Exact OpenAPI schema compliance
      expect(response.status).toBe(201);
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
