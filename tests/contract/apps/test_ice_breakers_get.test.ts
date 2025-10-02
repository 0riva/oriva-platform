/**
 * Contract Test: GET /api/v1/apps/ice-breakers
 * Task: T015
 *
 * TDD Phase: RED - Test written before implementation
 * This test MUST fail initially before implementation
 */

import request from 'supertest';
import { createTestClient } from '../../../test-utils/client';
import { mockSupabase } from '../../../test-utils/supabase';

describe('GET /api/v1/apps/ice-breakers', () => {
  let client: any;
  const testProfileId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    jest.clearAllMocks();
    client = createTestClient();
  });

  describe('Contract Validation - Hugo Love Ice Breakers', () => {
    it('should return personalized ice breakers for hugo_love', async () => {
      // Arrange
      const mockIceBreakers = [
        {
          id: 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e',
          profile_id: testProfileId,
          content: "I noticed you love hiking! What's your favorite trail around here?",
          category: 'shared_interest',
          confidence: 0.88,
          personalization_factors: {
            matched_interests: ['hiking'],
            tone: 'casual_friendly',
            length: 'medium',
          },
          created_at: '2025-01-02T16:30:00Z',
        },
        {
          id: 'd4b5f8e9-f0c2-5d3b-9g6f-2c4e6g8b0d3f',
          profile_id: testProfileId,
          content: 'Your photo at Yosemite is amazing! Have you done the Half Dome hike?',
          category: 'photo_comment',
          confidence: 0.85,
          personalization_factors: {
            photo_reference: true,
            specific_detail: 'Yosemite',
            tone: 'enthusiastic',
          },
          created_at: '2025-01-02T16:30:01Z',
        },
        {
          id: 'e5c6g9f0-g1d3-6e4c-0h7g-3d5f7h9c1e4g',
          profile_id: testProfileId,
          content: "I'm also into trying new restaurants. Any recent discoveries worth sharing?",
          category: 'shared_interest',
          confidence: 0.82,
          personalization_factors: {
            matched_interests: ['food', 'restaurants'],
            opens_conversation: true,
          },
          created_at: '2025-01-02T16:30:02Z',
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: mockIceBreakers,
                error: null,
              }),
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .get(`/api/v1/apps/ice-breakers?profile_id=${testProfileId}`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key');

      // Assert - Contract requirements
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('ice_breakers');
      expect(Array.isArray(response.body.ice_breakers)).toBe(true);
      expect(response.body.ice_breakers).toHaveLength(3);

      // Validate ice breaker structure
      const firstIceBreaker = response.body.ice_breakers[0];
      expect(firstIceBreaker).toMatchObject({
        id: expect.any(String),
        profile_id: testProfileId,
        content: expect.stringContaining('hiking'),
        category: expect.stringMatching(/^(shared_interest|photo_comment|conversation_starter)$/),
        confidence: expect.any(Number),
      });
    });

    it('should only work for hugo_love app (app-specific feature)', async () => {
      // Arrange
      const mockIceBreakers = [
        {
          id: 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e',
          profile_id: testProfileId,
          content: 'Great opener',
          category: 'shared_interest',
          confidence: 0.85,
          created_at: '2025-01-02T16:30:00Z',
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: mockIceBreakers,
                error: null,
              }),
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .get(`/api/v1/apps/ice-breakers?profile_id=${testProfileId}`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key');

      // Assert - Works for hugo_love
      expect(response.status).toBe(200);
      expect(response.body.ice_breakers).toHaveLength(1);
    });

    it('should return 404 for unsupported apps like hugo_career', async () => {
      // Act - Try to access ice-breakers from hugo_career
      const response = await request(client)
        .get(`/api/v1/apps/ice-breakers?profile_id=${testProfileId}`)
        .set('X-App-ID', 'hugo_career')
        .set('X-API-Key', 'test-api-key');

      // Assert - Feature not supported for hugo_career
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
        .set('X-API-Key', 'test-api-key');

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
        .set('X-API-Key', 'test-api-key');

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
        .get(`/api/v1/apps/ice-breakers?profile_id=${testProfileId}`)
        .set('X-App-ID', 'hugo_love');

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'UNAUTHORIZED',
        message: expect.stringContaining('API key'),
      });
    });

    it('should support limit parameter', async () => {
      // Arrange
      const limitedIceBreakers = [
        {
          id: 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e',
          profile_id: testProfileId,
          content: 'First ice breaker',
          category: 'shared_interest',
          confidence: 0.88,
          created_at: '2025-01-02T16:30:00Z',
        },
        {
          id: 'd4b5f8e9-f0c2-5d3b-9g6f-2c4e6g8b0d3f',
          profile_id: testProfileId,
          content: 'Second ice breaker',
          category: 'photo_comment',
          confidence: 0.85,
          created_at: '2025-01-02T16:30:01Z',
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: limitedIceBreakers,
                error: null,
              }),
            }),
          }),
        }),
      });

      // Act - Request only 2 ice breakers
      const response = await request(client)
        .get(`/api/v1/apps/ice-breakers?profile_id=${testProfileId}&limit=2`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.ice_breakers).toHaveLength(2);
    });

    it('should filter by minimum confidence', async () => {
      // Arrange
      const highConfidenceIceBreakers = [
        {
          id: 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e',
          profile_id: testProfileId,
          content: 'High confidence opener',
          category: 'shared_interest',
          confidence: 0.92,
          created_at: '2025-01-02T16:30:00Z',
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: highConfidenceIceBreakers,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      // Act - Request only high confidence ice breakers
      const response = await request(client)
        .get(`/api/v1/apps/ice-breakers?profile_id=${testProfileId}&min_confidence=0.9`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.ice_breakers[0].confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should filter by category', async () => {
      // Arrange
      const photoCommentIceBreakers = [
        {
          id: 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e',
          profile_id: testProfileId,
          content: 'Love that photo!',
          category: 'photo_comment',
          confidence: 0.85,
          created_at: '2025-01-02T16:30:00Z',
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: photoCommentIceBreakers,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .get(`/api/v1/apps/ice-breakers?profile_id=${testProfileId}&category=photo_comment`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.ice_breakers[0].category).toBe('photo_comment');
    });

    it('should return empty array when no ice breakers available', async () => {
      // Arrange
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .get(`/api/v1/apps/ice-breakers?profile_id=${testProfileId}`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        ice_breakers: [],
      });
    });
  });

  describe('OpenAPI Contract Compliance', () => {
    it('should match OpenAPI schema for successful response', async () => {
      // Arrange
      const mockIceBreakers = [
        {
          id: 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e',
          profile_id: testProfileId,
          content: "I see you're into photography! What's your favorite subject to shoot?",
          category: 'shared_interest',
          confidence: 0.87,
          personalization_factors: {
            matched_interests: ['photography'],
            tone: 'curious_friendly',
            opens_conversation: true,
          },
          created_at: '2025-01-02T16:30:00Z',
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: mockIceBreakers,
                error: null,
              }),
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .get(`/api/v1/apps/ice-breakers?profile_id=${testProfileId}`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key');

      // Assert - Exact OpenAPI schema compliance
      expect(response.status).toBe(200);
      const body = response.body;

      // Response wrapper
      expect(body).toHaveProperty('ice_breakers');
      expect(Array.isArray(body.ice_breakers)).toBe(true);

      // Validate each ice breaker in array
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
        expect(new Date(iceBreaker.created_at).toISOString()).toBe(iceBreaker.created_at);

        // Optional personalization_factors validation
        if (iceBreaker.personalization_factors) {
          expect(typeof iceBreaker.personalization_factors).toBe('object');
        }
      });
    });

    it('should return error matching OpenAPI Error schema', async () => {
      // Arrange - Invalid profile_id to trigger error
      const invalidProfileId = 'invalid-uuid-format';

      // Act
      const response = await request(client)
        .get(`/api/v1/apps/ice-breakers?profile_id=${invalidProfileId}`)
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
