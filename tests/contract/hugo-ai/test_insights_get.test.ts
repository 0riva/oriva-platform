/**
 * Contract Test: GET /api/v1/hugo-ai/insights
 * Task: T012
 *
 * TDD Phase: RED - Test written before implementation
 * This test MUST fail initially before implementation
 */

import request from 'supertest';
import { createTestClient } from '../../../test-utils/client';
import { mockSupabase } from '../../../test-utils/supabase';

describe('GET /api/v1/hugo-ai/insights', () => {
  let client: any;
  const testUserId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    jest.clearAllMocks();
    client = createTestClient();
  });

  describe('Contract Validation', () => {
    it('should return user insights with cross-app data', async () => {
      // Arrange
      const mockInsights = [
        {
          id: 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e',
          user_id: testUserId,
          session_id: '123e4567-e89b-12d3-a456-426614174000',
          insight_type: 'pattern',
          content: 'Strong active listening skills demonstrated consistently',
          confidence: 0.88,
          source_app_id: 'hugo_love',
          cross_app_visibility: true,
          supporting_data: {
            sessions_analyzed: 5,
            pattern_frequency: 0.85,
          },
          created_at: '2025-01-02T15:00:00Z',
        },
        {
          id: 'd4b5f8e9-f0c2-5d3b-9g6f-2c4e6g8b0d3f',
          user_id: testUserId,
          session_id: '223e4567-e89b-12d3-a456-426614174001',
          insight_type: 'recommendation',
          content: 'Consider exploring career coaching for communication skills transfer',
          confidence: 0.75,
          source_app_id: 'hugo_career', // Cross-app insight
          cross_app_visibility: true,
          supporting_data: {
            transferable_skills: ['communication', 'empathy', 'active_listening'],
          },
          created_at: '2025-01-02T16:00:00Z',
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockInsights,
              error: null,
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .get(`/api/v1/hugo-ai/insights?user_id=${testUserId}`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key');

      // Assert - Contract requirements
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('insights');
      expect(Array.isArray(response.body.insights)).toBe(true);
      expect(response.body.insights).toHaveLength(2);

      // Verify cross-app insight is included
      const crossAppInsight = response.body.insights.find(
        (i: any) => i.source_app_id === 'hugo_career'
      );
      expect(crossAppInsight).toBeDefined();
      expect(crossAppInsight.cross_app_visibility).toBe(true);
    });

    it('should filter by confidence threshold', async () => {
      // Arrange
      const mockInsights = [
        {
          id: 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e',
          user_id: testUserId,
          insight_type: 'pattern',
          content: 'High confidence pattern',
          confidence: 0.88,
          source_app_id: 'hugo_love',
          cross_app_visibility: true,
          created_at: '2025-01-02T15:00:00Z',
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: mockInsights,
                error: null,
              }),
            }),
          }),
        }),
      });

      // Act - Request only high confidence insights
      const response = await request(client)
        .get(`/api/v1/hugo-ai/insights?user_id=${testUserId}&min_confidence=0.8`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.insights).toHaveLength(1);
      expect(response.body.insights[0].confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should filter by insight_type', async () => {
      // Arrange
      const mockInsights = [
        {
          id: 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e',
          user_id: testUserId,
          insight_type: 'recommendation',
          content: 'Try this approach',
          confidence: 0.85,
          source_app_id: 'hugo_love',
          cross_app_visibility: true,
          created_at: '2025-01-02T15:00:00Z',
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: mockInsights,
                error: null,
              }),
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .get(`/api/v1/hugo-ai/insights?user_id=${testUserId}&insight_type=recommendation`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.insights).toHaveLength(1);
      expect(response.body.insights[0].insight_type).toBe('recommendation');
    });

    it('should filter by source_app_id', async () => {
      // Arrange - Filter for insights from specific app
      const mockInsights = [
        {
          id: 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e',
          user_id: testUserId,
          insight_type: 'pattern',
          content: 'Career-specific insight',
          confidence: 0.82,
          source_app_id: 'hugo_career',
          cross_app_visibility: true,
          created_at: '2025-01-02T15:00:00Z',
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: mockInsights,
                error: null,
              }),
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .get(`/api/v1/hugo-ai/insights?user_id=${testUserId}&source_app_id=hugo_career`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.insights.every((i: any) => i.source_app_id === 'hugo_career')).toBe(
        true
      );
    });

    it('should require user_id query parameter', async () => {
      // Act - No user_id provided
      const response = await request(client)
        .get('/api/v1/hugo-ai/insights')
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
        .get(`/api/v1/hugo-ai/insights?user_id=${invalidUserId}`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'INVALID_USER_ID',
        message: expect.stringContaining('Invalid user ID format'),
      });
    });

    it('should require X-App-ID header for schema routing', async () => {
      // Act - Missing X-App-ID header
      const response = await request(client)
        .get(`/api/v1/hugo-ai/insights?user_id=${testUserId}`)
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
        .get(`/api/v1/hugo-ai/insights?user_id=${testUserId}`)
        .set('X-App-ID', 'hugo_love');

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'UNAUTHORIZED',
        message: expect.stringContaining('API key'),
      });
    });

    it('should only return insights with cross_app_visibility=true from other apps', async () => {
      // Arrange - Mix of visible and non-visible insights
      const mockInsights = [
        {
          id: 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e',
          user_id: testUserId,
          insight_type: 'pattern',
          content: 'Hugo Love insight (visible)',
          confidence: 0.88,
          source_app_id: 'hugo_love',
          cross_app_visibility: true,
          created_at: '2025-01-02T15:00:00Z',
        },
        {
          id: 'd4b5f8e9-f0c2-5d3b-9g6f-2c4e6g8b0d3f',
          user_id: testUserId,
          insight_type: 'pattern',
          content: 'Hugo Career insight (visible - high confidence)',
          confidence: 0.75,
          source_app_id: 'hugo_career',
          cross_app_visibility: true, // Visible across apps
          created_at: '2025-01-02T16:00:00Z',
        },
        // Low confidence insight from hugo_career should NOT appear for hugo_love
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockInsights,
              error: null,
            }),
          }),
        }),
      });

      // Act - Request from hugo_love app
      const response = await request(client)
        .get(`/api/v1/hugo-ai/insights?user_id=${testUserId}`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.insights).toHaveLength(2);
      expect(
        response.body.insights.every((i: any) => i.cross_app_visibility === true)
      ).toBe(true);
    });

    it('should support pagination parameters', async () => {
      // Arrange
      const paginatedInsights = [
        {
          id: 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e',
          user_id: testUserId,
          insight_type: 'pattern',
          content: 'First page insight',
          confidence: 0.85,
          source_app_id: 'hugo_love',
          cross_app_visibility: true,
          created_at: '2025-01-02T15:00:00Z',
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            range: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: paginatedInsights,
                error: null,
              }),
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .get(`/api/v1/hugo-ai/insights?user_id=${testUserId}&limit=10&offset=0`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.insights).toHaveLength(1);
    });

    it('should handle empty insights list', async () => {
      // Arrange
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .get(`/api/v1/hugo-ai/insights?user_id=${testUserId}`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        insights: [],
      });
    });
  });

  describe('OpenAPI Contract Compliance', () => {
    it('should match OpenAPI schema for successful response', async () => {
      // Arrange
      const mockInsights = [
        {
          id: 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e',
          user_id: testUserId,
          session_id: '123e4567-e89b-12d3-a456-426614174000',
          insight_type: 'pattern',
          content: 'Consistent improvement in communication skills',
          confidence: 0.88,
          source_app_id: 'hugo_love',
          cross_app_visibility: true,
          supporting_data: {
            sessions_analyzed: 5,
            pattern_frequency: 0.85,
            improvement_trend: 'positive',
          },
          created_at: '2025-01-02T15:00:00Z',
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockInsights,
              error: null,
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .get(`/api/v1/hugo-ai/insights?user_id=${testUserId}`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key');

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
        expect(new Date(insight.created_at).toISOString()).toBe(insight.created_at);

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
      // Arrange - Invalid user_id to trigger error
      const invalidUserId = 'invalid-uuid-format';

      // Act
      const response = await request(client)
        .get(`/api/v1/hugo-ai/insights?user_id=${invalidUserId}`)
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
