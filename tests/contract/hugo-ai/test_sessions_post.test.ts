/**
 * Contract Test: POST /api/v1/hugo-ai/sessions
 * Task: T009
 *
 * TDD Phase: RED - Test written before implementation
 * This test MUST fail initially before implementation
 */

import request from 'supertest';
import { createTestClient } from '../../../test-utils/client';
import { mockSupabase } from '../../../test-utils/supabase';

describe('POST /api/v1/hugo-ai/sessions', () => {
  let client: any;

  beforeEach(() => {
    jest.clearAllMocks();
    client = createTestClient();
  });

  describe('Contract Validation', () => {
    it('should start a new coaching session', async () => {
      // Arrange
      const validRequest = {
        session_type: 'coaching',
        context_data: {
          domain: 'dating',
          goals: ['improve_confidence', 'better_conversations'],
          mood: 'optimistic',
          topic: 'first_date_preparation'
        }
      };

      const mockSession = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        app_id: '223e4567-e89b-12d3-a456-426614174001',
        session_type: 'coaching',
        started_at: new Date().toISOString(),
        ended_at: null,
        duration_seconds: null,
        message_count: 0,
        context_data: validRequest.context_data,
        insights_generated: [],
        quality_score: null,
        created_at: new Date().toISOString()
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockSession,
              error: null
            })
          })
        })
      });

      // Act
      const response = await request(client)
        .post('/api/v1/hugo-ai/sessions')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(validRequest);

      // Assert - Contract requirements
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: expect.any(String),
        user_id: expect.any(String),
        app_id: expect.any(String),
        session_type: 'coaching',
        started_at: expect.any(String),
        message_count: 0,
        context_data: expect.objectContaining({
          domain: 'dating',
          goals: expect.any(Array)
        })
      });
    });

    it('should validate session_type enum', async () => {
      // Arrange
      const invalidRequest = {
        session_type: 'invalid_type',
        context_data: {
          domain: 'dating'
        }
      };

      // Act
      const response = await request(client)
        .post('/api/v1/hugo-ai/sessions')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(invalidRequest);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'INVALID_SESSION_TYPE',
        message: expect.stringContaining('chat, analysis, coaching, or practice')
      });
    });

    it('should require session_type field', async () => {
      // Arrange
      const invalidRequest = {
        context_data: {
          domain: 'dating'
        }
      };

      // Act
      const response = await request(client)
        .post('/api/v1/hugo-ai/sessions')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(invalidRequest);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: expect.stringContaining('session_type')
      });
    });

    it('should require X-App-ID header for schema routing', async () => {
      // Arrange
      const validRequest = {
        session_type: 'chat',
        context_data: {}
      };

      // Act - Missing X-App-ID header
      const response = await request(client)
        .post('/api/v1/hugo-ai/sessions')
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(validRequest);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'MISSING_APP_ID',
        message: expect.stringContaining('X-App-ID header')
      });
    });

    it('should require API key authentication', async () => {
      // Arrange
      const validRequest = {
        session_type: 'chat',
        context_data: {}
      };

      // Act - No API key
      const response = await request(client)
        .post('/api/v1/hugo-ai/sessions')
        .set('X-App-ID', 'hugo_love')
        .set('Content-Type', 'application/json')
        .send(validRequest);

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'UNAUTHORIZED',
        message: expect.stringContaining('API key')
      });
    });

    it('should accept all valid session types', async () => {
      const sessionTypes = ['chat', 'analysis', 'coaching', 'practice'];

      for (const sessionType of sessionTypes) {
        // Arrange
        const validRequest = {
          session_type: sessionType,
          context_data: {
            domain: 'dating'
          }
        };

        mockSupabase.from.mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: '123e4567-e89b-12d3-a456-426614174000',
                  user_id: '550e8400-e29b-41d4-a716-446655440000',
                  app_id: '223e4567-e89b-12d3-a456-426614174001',
                  session_type: sessionType,
                  started_at: new Date().toISOString(),
                  message_count: 0,
                  context_data: validRequest.context_data,
                  insights_generated: [],
                  created_at: new Date().toISOString()
                },
                error: null
              })
            })
          })
        });

        // Act
        const response = await request(client)
          .post('/api/v1/hugo-ai/sessions')
          .set('X-App-ID', 'hugo_love')
          .set('X-API-Key', 'test-api-key')
          .set('Content-Type', 'application/json')
          .send(validRequest);

        // Assert
        expect(response.status).toBe(201);
        expect(response.body.session_type).toBe(sessionType);
      }
    });

    it('should handle optional context_data gracefully', async () => {
      // Arrange
      const minimalRequest = {
        session_type: 'chat'
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: '123e4567-e89b-12d3-a456-426614174000',
                user_id: '550e8400-e29b-41d4-a716-446655440000',
                app_id: '223e4567-e89b-12d3-a456-426614174001',
                session_type: 'chat',
                started_at: new Date().toISOString(),
                message_count: 0,
                context_data: {},
                insights_generated: [],
                created_at: new Date().toISOString()
              },
              error: null
            })
          })
        })
      });

      // Act
      const response = await request(client)
        .post('/api/v1/hugo-ai/sessions')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(minimalRequest);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('context_data');
    });
  });

  describe('OpenAPI Contract Compliance', () => {
    it('should match OpenAPI schema for successful response', async () => {
      // Arrange
      const validRequest = {
        session_type: 'coaching',
        context_data: {
          domain: 'dating',
          goals: ['improve_confidence'],
          mood: 'nervous',
          topic: 'first_date'
        }
      };

      const mockSession = {
        id: 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e',
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        app_id: '223e4567-e89b-12d3-a456-426614174001',
        session_type: 'coaching',
        started_at: '2025-01-02T15:30:00Z',
        ended_at: null,
        duration_seconds: null,
        message_count: 0,
        context_data: validRequest.context_data,
        insights_generated: [],
        quality_score: null,
        created_at: '2025-01-02T15:30:00Z'
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockSession,
              error: null
            })
          })
        })
      });

      // Act
      const response = await request(client)
        .post('/api/v1/hugo-ai/sessions')
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

      // Optional fields validation when present
      if (body.ended_at !== null && body.ended_at !== undefined) {
        expect(typeof body.ended_at).toBe('string');
        expect(new Date(body.ended_at).toISOString()).toBe(body.ended_at);
      }

      if (body.duration_seconds !== null && body.duration_seconds !== undefined) {
        expect(typeof body.duration_seconds).toBe('number');
      }

      if (body.context_data) {
        expect(typeof body.context_data).toBe('object');
      }

      if (body.insights_generated) {
        expect(Array.isArray(body.insights_generated)).toBe(true);
      }

      if (body.quality_score !== null && body.quality_score !== undefined) {
        expect(typeof body.quality_score).toBe('number');
        expect(body.quality_score).toBeGreaterThanOrEqual(0);
        expect(body.quality_score).toBeLessThanOrEqual(100);
      }
    });

    it('should return error matching OpenAPI Error schema', async () => {
      // Arrange - Invalid request to trigger error
      const invalidRequest = {
        session_type: 'invalid_type'
      };

      // Act
      const response = await request(client)
        .post('/api/v1/hugo-ai/sessions')
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