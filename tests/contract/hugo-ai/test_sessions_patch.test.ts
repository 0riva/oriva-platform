/**
 * Contract Test: PATCH /api/v1/hugo-ai/sessions/{sessionId}
 * Task: T010
 *
 * TDD Phase: RED - Test written before implementation
 * This test MUST fail initially before implementation
 */

import request from 'supertest';
import { createTestClient } from '../../../test-utils/client';
import { mockSupabase } from '../../../test-utils/supabase';

describe('PATCH /api/v1/hugo-ai/sessions/{sessionId}', () => {
  let client: any;
  const testSessionId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    jest.clearAllMocks();
    client = createTestClient();
  });

  describe('Contract Validation', () => {
    it('should end a session successfully', async () => {
      // Arrange
      const updateRequest = {
        ended_at: '2025-01-02T16:00:00Z',
        duration_seconds: 1800,
        insights_generated: [
          {
            insight_type: 'pattern',
            content: 'User shows consistent anxiety about first dates',
            confidence: 0.85,
            supporting_data: {
              message_count: 15,
              keywords: ['nervous', 'anxious', 'worried'],
            },
          },
        ],
        quality_score: 82,
      };

      const mockUpdatedSession = {
        id: testSessionId,
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        app_id: '223e4567-e89b-12d3-a456-426614174001',
        session_type: 'coaching',
        started_at: '2025-01-02T15:30:00Z',
        ended_at: updateRequest.ended_at,
        duration_seconds: updateRequest.duration_seconds,
        message_count: 15,
        context_data: {
          domain: 'dating',
          goals: ['improve_confidence'],
        },
        insights_generated: updateRequest.insights_generated,
        quality_score: updateRequest.quality_score,
        created_at: '2025-01-02T15:30:00Z',
      };

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockUpdatedSession,
                error: null,
              }),
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .patch(`/api/v1/hugo-ai/sessions/${testSessionId}`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(updateRequest);

      // Assert - Contract requirements
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: testSessionId,
        ended_at: updateRequest.ended_at,
        duration_seconds: updateRequest.duration_seconds,
        insights_generated: expect.arrayContaining([
          expect.objectContaining({
            insight_type: 'pattern',
            confidence: 0.85,
          }),
        ]),
        quality_score: 82,
      });
    });

    it('should validate session exists before update', async () => {
      // Arrange
      const nonExistentSessionId = '999e8400-e29b-41d4-a716-446655440999';
      const updateRequest = {
        ended_at: '2025-01-02T16:00:00Z',
      };

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: {
                  code: 'PGRST116',
                  message: 'The result contains 0 rows',
                },
              }),
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .patch(`/api/v1/hugo-ai/sessions/${nonExistentSessionId}`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(updateRequest);

      // Assert
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        code: 'SESSION_NOT_FOUND',
        message: expect.stringContaining('Session not found'),
      });
    });

    it('should validate UUID format for sessionId', async () => {
      // Arrange
      const invalidSessionId = 'not-a-uuid';
      const updateRequest = {
        ended_at: '2025-01-02T16:00:00Z',
      };

      // Act
      const response = await request(client)
        .patch(`/api/v1/hugo-ai/sessions/${invalidSessionId}`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(updateRequest);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'INVALID_SESSION_ID',
        message: expect.stringContaining('Invalid session ID format'),
      });
    });

    it('should require X-App-ID header for schema routing', async () => {
      // Arrange
      const updateRequest = {
        ended_at: '2025-01-02T16:00:00Z',
      };

      // Act - Missing X-App-ID header
      const response = await request(client)
        .patch(`/api/v1/hugo-ai/sessions/${testSessionId}`)
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(updateRequest);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'MISSING_APP_ID',
        message: expect.stringContaining('X-App-ID header'),
      });
    });

    it('should require API key authentication', async () => {
      // Arrange
      const updateRequest = {
        ended_at: '2025-01-02T16:00:00Z',
      };

      // Act - No API key
      const response = await request(client)
        .patch(`/api/v1/hugo-ai/sessions/${testSessionId}`)
        .set('X-App-ID', 'hugo_love')
        .set('Content-Type', 'application/json')
        .send(updateRequest);

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'UNAUTHORIZED',
        message: expect.stringContaining('API key'),
      });
    });

    it('should allow partial updates', async () => {
      // Arrange - Only update insights_generated
      const partialUpdate = {
        insights_generated: [
          {
            insight_type: 'recommendation',
            content: 'Consider focusing on active listening skills',
            confidence: 0.78,
            supporting_data: {
              conversation_flow: 'one-sided',
            },
          },
        ],
      };

      const mockSession = {
        id: testSessionId,
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        app_id: '223e4567-e89b-12d3-a456-426614174001',
        session_type: 'coaching',
        started_at: '2025-01-02T15:30:00Z',
        ended_at: null,
        duration_seconds: null,
        message_count: 8,
        insights_generated: partialUpdate.insights_generated,
        quality_score: null,
        created_at: '2025-01-02T15:30:00Z',
      };

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockSession,
                error: null,
              }),
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .patch(`/api/v1/hugo-ai/sessions/${testSessionId}`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(partialUpdate);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.insights_generated).toHaveLength(1);
      expect(response.body.ended_at).toBeNull();
    });

    it('should validate quality_score range', async () => {
      // Arrange - Invalid quality score
      const invalidUpdate = {
        quality_score: 150, // Must be 0-100
      };

      // Act
      const response = await request(client)
        .patch(`/api/v1/hugo-ai/sessions/${testSessionId}`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(invalidUpdate);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'INVALID_QUALITY_SCORE',
        message: expect.stringContaining('0 and 100'),
      });
    });

    it('should validate insights_generated structure', async () => {
      // Arrange - Missing required fields
      const invalidUpdate = {
        insights_generated: [
          {
            // Missing insight_type and content
            confidence: 0.85,
          },
        ],
      };

      // Act
      const response = await request(client)
        .patch(`/api/v1/hugo-ai/sessions/${testSessionId}`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(invalidUpdate);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: expect.stringContaining('insight_type'),
      });
    });

    it('should calculate duration_seconds if not provided', async () => {
      // Arrange
      const updateRequest = {
        ended_at: '2025-01-02T16:00:00Z',
        // duration_seconds not provided - should be calculated
      };

      const mockSession = {
        id: testSessionId,
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        app_id: '223e4567-e89b-12d3-a456-426614174001',
        session_type: 'coaching',
        started_at: '2025-01-02T15:30:00Z',
        ended_at: updateRequest.ended_at,
        duration_seconds: 1800, // 30 minutes calculated
        message_count: 10,
        created_at: '2025-01-02T15:30:00Z',
      };

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockSession,
                error: null,
              }),
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .patch(`/api/v1/hugo-ai/sessions/${testSessionId}`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(updateRequest);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.duration_seconds).toBe(1800);
    });
  });

  describe('OpenAPI Contract Compliance', () => {
    it('should match OpenAPI schema for successful response', async () => {
      // Arrange
      const updateRequest = {
        ended_at: '2025-01-02T16:00:00Z',
        duration_seconds: 1800,
        insights_generated: [
          {
            insight_type: 'pattern',
            content: 'Strong communication skills evident',
            confidence: 0.88,
            supporting_data: {
              engagement_metrics: {
                response_quality: 0.9,
                empathy_score: 0.85,
              },
            },
          },
        ],
        quality_score: 87,
      };

      const mockSession = {
        id: testSessionId,
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        app_id: '223e4567-e89b-12d3-a456-426614174001',
        session_type: 'coaching',
        started_at: '2025-01-02T15:30:00Z',
        ended_at: updateRequest.ended_at,
        duration_seconds: updateRequest.duration_seconds,
        message_count: 12,
        context_data: {
          domain: 'dating',
          goals: ['improve_confidence'],
        },
        insights_generated: updateRequest.insights_generated,
        quality_score: updateRequest.quality_score,
        created_at: '2025-01-02T15:30:00Z',
      };

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockSession,
                error: null,
              }),
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .patch(`/api/v1/hugo-ai/sessions/${testSessionId}`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(updateRequest);

      // Assert - Exact OpenAPI schema compliance
      expect(response.status).toBe(200);
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
      expect(body.user_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(typeof body.app_id).toBe('string');
      expect(body.app_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(['chat', 'analysis', 'coaching', 'practice']).toContain(body.session_type);
      expect(typeof body.started_at).toBe('string');
      expect(new Date(body.started_at).toISOString()).toBe(body.started_at);
      expect(typeof body.message_count).toBe('number');

      // Updated fields validation
      expect(typeof body.ended_at).toBe('string');
      expect(new Date(body.ended_at).toISOString()).toBe(body.ended_at);
      expect(typeof body.duration_seconds).toBe('number');
      expect(body.duration_seconds).toBeGreaterThan(0);

      // Insights validation
      expect(Array.isArray(body.insights_generated)).toBe(true);
      expect(body.insights_generated.length).toBeGreaterThan(0);
      body.insights_generated.forEach((insight: any) => {
        expect(insight).toHaveProperty('insight_type');
        expect(insight).toHaveProperty('content');
        expect(insight).toHaveProperty('confidence');
        expect(typeof insight.insight_type).toBe('string');
        expect(typeof insight.content).toBe('string');
        expect(typeof insight.confidence).toBe('number');
        expect(insight.confidence).toBeGreaterThanOrEqual(0);
        expect(insight.confidence).toBeLessThanOrEqual(1);
      });

      // Quality score validation
      expect(typeof body.quality_score).toBe('number');
      expect(body.quality_score).toBeGreaterThanOrEqual(0);
      expect(body.quality_score).toBeLessThanOrEqual(100);
    });

    it('should return error matching OpenAPI Error schema', async () => {
      // Arrange - Invalid sessionId to trigger error
      const invalidSessionId = 'invalid-uuid';
      const updateRequest = {
        ended_at: '2025-01-02T16:00:00Z',
      };

      // Act
      const response = await request(client)
        .patch(`/api/v1/hugo-ai/sessions/${invalidSessionId}`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(updateRequest);

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
