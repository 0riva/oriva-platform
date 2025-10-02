/**
 * Contract Test: POST /api/v1/hugo-ai/insights
 * Task: T011
 *
 * TDD Phase: RED - Test written before implementation
 * This test MUST fail initially before implementation
 */

import request from 'supertest';
import { createTestClient } from '../../../test-utils/client';
import { mockSupabase } from '../../../test-utils/supabase';

describe('POST /api/v1/hugo-ai/insights', () => {
  let client: any;

  beforeEach(() => {
    jest.clearAllMocks();
    client = createTestClient();
  });

  describe('Contract Validation', () => {
    it('should create a new insight successfully', async () => {
      // Arrange
      const validRequest = {
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        session_id: '123e4567-e89b-12d3-a456-426614174000',
        insight_type: 'pattern',
        content: 'User demonstrates strong active listening skills in practice conversations',
        confidence: 0.87,
        source_app_id: 'hugo_love',
        supporting_data: {
          sessions_analyzed: 5,
          pattern_frequency: 0.82,
          keywords: ['listening', 'empathy', 'engagement'],
          improvement_metrics: {
            baseline: 0.65,
            current: 0.87,
            trend: 'improving',
          },
        },
      };

      const mockInsight = {
        id: 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e',
        ...validRequest,
        cross_app_visibility: true,
        created_at: '2025-01-02T16:30:00Z',
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockInsight,
              error: null,
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .post('/api/v1/hugo-ai/insights')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(validRequest);

      // Assert - Contract requirements
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: expect.any(String),
        user_id: validRequest.user_id,
        insight_type: 'pattern',
        content: expect.stringContaining('listening'),
        confidence: 0.87,
        source_app_id: 'hugo_love',
        cross_app_visibility: true,
      });
    });

    it('should require user_id field', async () => {
      // Arrange
      const invalidRequest = {
        insight_type: 'pattern',
        content: 'Some insight',
        confidence: 0.85,
      };

      // Act
      const response = await request(client)
        .post('/api/v1/hugo-ai/insights')
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

    it('should validate insight_type enum', async () => {
      // Arrange
      const invalidRequest = {
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        insight_type: 'invalid_type',
        content: 'Some insight',
        confidence: 0.85,
      };

      // Act
      const response = await request(client)
        .post('/api/v1/hugo-ai/insights')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(invalidRequest);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'INVALID_INSIGHT_TYPE',
        message: expect.stringContaining('pattern, recommendation, or goal_progress'),
      });
    });

    it('should validate confidence range (0-1)', async () => {
      // Arrange
      const invalidRequest = {
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        insight_type: 'pattern',
        content: 'Some insight',
        confidence: 1.5, // Invalid - must be 0-1
      };

      // Act
      const response = await request(client)
        .post('/api/v1/hugo-ai/insights')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(invalidRequest);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'INVALID_CONFIDENCE',
        message: expect.stringContaining('between 0 and 1'),
      });
    });

    it('should apply 0.7 confidence threshold for cross-app visibility', async () => {
      // Arrange
      const lowConfidenceRequest = {
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        insight_type: 'pattern',
        content: 'Tentative insight with low confidence',
        confidence: 0.65, // Below 0.7 threshold
        source_app_id: 'hugo_love',
      };

      const mockInsight = {
        id: 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e',
        ...lowConfidenceRequest,
        cross_app_visibility: false, // Should be false due to low confidence
        created_at: '2025-01-02T16:30:00Z',
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockInsight,
              error: null,
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .post('/api/v1/hugo-ai/insights')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(lowConfidenceRequest);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.cross_app_visibility).toBe(false);
      expect(response.body.confidence).toBe(0.65);
    });

    it('should enable cross-app visibility for confidence >= 0.7', async () => {
      // Arrange
      const highConfidenceRequest = {
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        insight_type: 'recommendation',
        content: 'Strong recommendation based on pattern analysis',
        confidence: 0.82, // Above 0.7 threshold
        source_app_id: 'hugo_love',
      };

      const mockInsight = {
        id: 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e',
        ...highConfidenceRequest,
        cross_app_visibility: true, // Should be true due to high confidence
        created_at: '2025-01-02T16:30:00Z',
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockInsight,
              error: null,
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .post('/api/v1/hugo-ai/insights')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(highConfidenceRequest);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.cross_app_visibility).toBe(true);
      expect(response.body.confidence).toBe(0.82);
    });

    it('should require X-App-ID header for schema routing', async () => {
      // Arrange
      const validRequest = {
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        insight_type: 'pattern',
        content: 'Some insight',
        confidence: 0.85,
      };

      // Act - Missing X-App-ID header
      const response = await request(client)
        .post('/api/v1/hugo-ai/insights')
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
        insight_type: 'pattern',
        content: 'Some insight',
        confidence: 0.85,
      };

      // Act - No API key
      const response = await request(client)
        .post('/api/v1/hugo-ai/insights')
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

    it('should accept all valid insight types', async () => {
      const insightTypes = ['pattern', 'recommendation', 'goal_progress'];

      for (const insightType of insightTypes) {
        // Arrange
        const validRequest = {
          user_id: '550e8400-e29b-41d4-a716-446655440000',
          insight_type: insightType,
          content: `Test ${insightType} insight`,
          confidence: 0.85,
          source_app_id: 'hugo_love',
        };

        mockSupabase.from.mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e',
                  ...validRequest,
                  cross_app_visibility: true,
                  created_at: '2025-01-02T16:30:00Z',
                },
                error: null,
              }),
            }),
          }),
        });

        // Act
        const response = await request(client)
          .post('/api/v1/hugo-ai/insights')
          .set('X-App-ID', 'hugo_love')
          .set('X-API-Key', 'test-api-key')
          .set('Content-Type', 'application/json')
          .send(validRequest);

        // Assert
        expect(response.status).toBe(201);
        expect(response.body.insight_type).toBe(insightType);
      }
    });

    it('should handle optional session_id field', async () => {
      // Arrange - No session_id provided
      const requestWithoutSession = {
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        insight_type: 'pattern',
        content: 'Insight derived from multiple sessions',
        confidence: 0.85,
        source_app_id: 'hugo_love',
      };

      const mockInsight = {
        id: 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e',
        ...requestWithoutSession,
        session_id: null,
        cross_app_visibility: true,
        created_at: '2025-01-02T16:30:00Z',
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockInsight,
              error: null,
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .post('/api/v1/hugo-ai/insights')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(requestWithoutSession);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.session_id).toBeNull();
    });
  });

  describe('OpenAPI Contract Compliance', () => {
    it('should match OpenAPI schema for successful response', async () => {
      // Arrange
      const validRequest = {
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        session_id: '123e4567-e89b-12d3-a456-426614174000',
        insight_type: 'pattern',
        content: 'User shows consistent improvement in communication patterns',
        confidence: 0.88,
        source_app_id: 'hugo_love',
        supporting_data: {
          analysis_window_days: 14,
          sessions_analyzed: 8,
          confidence_factors: {
            consistency: 0.92,
            sample_size: 0.85,
            recency: 0.87,
          },
        },
      };

      const mockInsight = {
        id: 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e',
        user_id: validRequest.user_id,
        session_id: validRequest.session_id,
        insight_type: validRequest.insight_type,
        content: validRequest.content,
        confidence: validRequest.confidence,
        source_app_id: validRequest.source_app_id,
        supporting_data: validRequest.supporting_data,
        cross_app_visibility: true,
        created_at: '2025-01-02T16:30:00Z',
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockInsight,
              error: null,
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .post('/api/v1/hugo-ai/insights')
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
      expect(body).toHaveProperty('insight_type');
      expect(body).toHaveProperty('content');
      expect(body).toHaveProperty('confidence');
      expect(body).toHaveProperty('source_app_id');
      expect(body).toHaveProperty('cross_app_visibility');
      expect(body).toHaveProperty('created_at');

      // Type validation per OpenAPI spec
      expect(typeof body.id).toBe('string');
      expect(body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(typeof body.user_id).toBe('string');
      expect(body.user_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(['pattern', 'recommendation', 'goal_progress']).toContain(body.insight_type);
      expect(typeof body.content).toBe('string');
      expect(typeof body.confidence).toBe('number');
      expect(body.confidence).toBeGreaterThanOrEqual(0);
      expect(body.confidence).toBeLessThanOrEqual(1);
      expect(typeof body.source_app_id).toBe('string');
      expect(typeof body.cross_app_visibility).toBe('boolean');
      expect(typeof body.created_at).toBe('string');
      expect(new Date(body.created_at).toISOString()).toBe(body.created_at);

      // Optional session_id validation
      if (body.session_id !== null && body.session_id !== undefined) {
        expect(typeof body.session_id).toBe('string');
        expect(body.session_id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );
      }

      // Optional supporting_data validation
      if (body.supporting_data) {
        expect(typeof body.supporting_data).toBe('object');
      }
    });

    it('should return error matching OpenAPI Error schema', async () => {
      // Arrange - Invalid request to trigger error
      const invalidRequest = {
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        insight_type: 'invalid_type', // Invalid enum value
        content: 'Some insight',
        confidence: 0.85,
      };

      // Act
      const response = await request(client)
        .post('/api/v1/hugo-ai/insights')
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
