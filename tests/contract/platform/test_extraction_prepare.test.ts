/**
 * Contract Test: POST /api/v1/platform/extraction/prepare
 * Task: T016
 *
 * TDD Phase: RED - Test written before implementation
 * This test MUST fail initially before implementation
 */

import request from 'supertest';
import { createTestClient } from '../../../test-utils/client';
import { mockSupabase } from '../../../test-utils/supabase';

describe('POST /api/v1/platform/extraction/prepare', () => {
  let client: any;
  const testUserId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    jest.clearAllMocks();
    client = createTestClient();
  });

  describe('Contract Validation', () => {
    it('should create extraction manifest for app migration', async () => {
      // Arrange
      const validRequest = {
        user_id: testUserId,
        source_app_id: 'hugo_love',
        target_format: 'json',
        include_schemas: ['profiles', 'sessions', 'insights'],
      };

      const mockManifest = {
        id: 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e',
        user_id: testUserId,
        source_app_id: 'hugo_love',
        status: 'prepared',
        target_format: 'json',
        data_summary: {
          profiles: 1,
          sessions: 15,
          insights: 8,
          total_size_bytes: 45678,
        },
        created_at: '2025-01-02T16:30:00Z',
        expires_at: '2025-01-09T16:30:00Z', // 7 days retention
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockManifest,
              error: null,
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .post('/api/v1/platform/extraction/prepare')
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(validRequest);

      // Assert - Contract requirements
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: expect.any(String),
        user_id: testUserId,
        source_app_id: 'hugo_love',
        status: 'prepared',
        target_format: 'json',
        data_summary: expect.objectContaining({
          profiles: 1,
          sessions: 15,
          insights: 8,
        }),
      });
    });

    it('should validate target_format enum', async () => {
      // Arrange
      const invalidRequest = {
        user_id: testUserId,
        source_app_id: 'hugo_love',
        target_format: 'xml', // Invalid format
      };

      // Act
      const response = await request(client)
        .post('/api/v1/platform/extraction/prepare')
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(invalidRequest);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'INVALID_TARGET_FORMAT',
        message: expect.stringContaining('json or csv'),
      });
    });

    it('should require user_id field', async () => {
      // Arrange
      const invalidRequest = {
        source_app_id: 'hugo_love',
        target_format: 'json',
      };

      // Act
      const response = await request(client)
        .post('/api/v1/platform/extraction/prepare')
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

    it('should require source_app_id field', async () => {
      // Arrange
      const invalidRequest = {
        user_id: testUserId,
        target_format: 'json',
      };

      // Act
      const response = await request(client)
        .post('/api/v1/platform/extraction/prepare')
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(invalidRequest);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: expect.stringContaining('source_app_id'),
      });
    });

    it('should validate user has access to source app', async () => {
      // Arrange
      const invalidRequest = {
        user_id: testUserId,
        source_app_id: 'unauthorized_app',
        target_format: 'json',
      };

      // Mock user has no access to unauthorized_app
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .post('/api/v1/platform/extraction/prepare')
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(invalidRequest);

      // Assert
      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        code: 'FORBIDDEN',
        message: expect.stringContaining('no access to app'),
      });
    });

    it('should require API key authentication', async () => {
      // Arrange
      const validRequest = {
        user_id: testUserId,
        source_app_id: 'hugo_love',
        target_format: 'json',
      };

      // Act - No API key
      const response = await request(client)
        .post('/api/v1/platform/extraction/prepare')
        .set('Content-Type', 'application/json')
        .send(validRequest);

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'UNAUTHORIZED',
        message: expect.stringContaining('API key'),
      });
    });

    it('should set 7-day retention for extraction manifest', async () => {
      // Arrange
      const validRequest = {
        user_id: testUserId,
        source_app_id: 'hugo_love',
        target_format: 'json',
      };

      const mockManifest = {
        id: 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e',
        user_id: testUserId,
        source_app_id: 'hugo_love',
        status: 'prepared',
        target_format: 'json',
        data_summary: {
          total_size_bytes: 1024,
        },
        created_at: '2025-01-02T16:30:00Z',
        expires_at: '2025-01-09T16:30:00Z', // Exactly 7 days later
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockManifest,
              error: null,
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .post('/api/v1/platform/extraction/prepare')
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(validRequest);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('expires_at');

      // Calculate time difference
      const createdDate = new Date(response.body.created_at);
      const expiresDate = new Date(response.body.expires_at);
      const daysDiff = (expiresDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);

      expect(daysDiff).toBe(7);
    });

    it('should support JSON and CSV target formats', async () => {
      const formats = ['json', 'csv'];

      for (const format of formats) {
        // Arrange
        const validRequest = {
          user_id: testUserId,
          source_app_id: 'hugo_love',
          target_format: format,
        };

        mockSupabase.from.mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e',
                  ...validRequest,
                  status: 'prepared',
                  data_summary: {},
                  created_at: '2025-01-02T16:30:00Z',
                  expires_at: '2025-01-09T16:30:00Z',
                },
                error: null,
              }),
            }),
          }),
        });

        // Act
        const response = await request(client)
          .post('/api/v1/platform/extraction/prepare')
          .set('X-API-Key', 'test-api-key')
          .set('Content-Type', 'application/json')
          .send(validRequest);

        // Assert
        expect(response.status).toBe(201);
        expect(response.body.target_format).toBe(format);
      }
    });

    it('should include data summary with size estimation', async () => {
      // Arrange
      const validRequest = {
        user_id: testUserId,
        source_app_id: 'hugo_love',
        target_format: 'json',
      };

      const mockManifest = {
        id: 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e',
        user_id: testUserId,
        source_app_id: 'hugo_love',
        status: 'prepared',
        target_format: 'json',
        data_summary: {
          profiles: 1,
          sessions: 24,
          insights: 12,
          messages: 450,
          total_size_bytes: 125678,
          estimated_download_time_seconds: 2,
        },
        created_at: '2025-01-02T16:30:00Z',
        expires_at: '2025-01-09T16:30:00Z',
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockManifest,
              error: null,
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .post('/api/v1/platform/extraction/prepare')
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(validRequest);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.data_summary).toMatchObject({
        total_size_bytes: expect.any(Number),
        profiles: expect.any(Number),
        sessions: expect.any(Number),
        insights: expect.any(Number),
      });
    });

    it('should support selective schema extraction via include_schemas', async () => {
      // Arrange
      const selectiveRequest = {
        user_id: testUserId,
        source_app_id: 'hugo_love',
        target_format: 'json',
        include_schemas: ['profiles', 'insights'], // Exclude sessions
      };

      const mockManifest = {
        id: 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e',
        user_id: testUserId,
        source_app_id: 'hugo_love',
        status: 'prepared',
        target_format: 'json',
        data_summary: {
          profiles: 1,
          insights: 8,
          // No sessions key - excluded
          total_size_bytes: 12345,
        },
        created_at: '2025-01-02T16:30:00Z',
        expires_at: '2025-01-09T16:30:00Z',
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockManifest,
              error: null,
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .post('/api/v1/platform/extraction/prepare')
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(selectiveRequest);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.data_summary).toHaveProperty('profiles');
      expect(response.body.data_summary).toHaveProperty('insights');
      expect(response.body.data_summary).not.toHaveProperty('sessions');
    });
  });

  describe('OpenAPI Contract Compliance', () => {
    it('should match OpenAPI schema for successful response', async () => {
      // Arrange
      const validRequest = {
        user_id: testUserId,
        source_app_id: 'hugo_love',
        target_format: 'json',
      };

      const mockManifest = {
        id: 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e',
        user_id: testUserId,
        source_app_id: 'hugo_love',
        status: 'prepared',
        target_format: 'json',
        data_summary: {
          profiles: 1,
          sessions: 18,
          insights: 9,
          total_size_bytes: 89012,
        },
        created_at: '2025-01-02T16:30:00Z',
        expires_at: '2025-01-09T16:30:00Z',
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockManifest,
              error: null,
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .post('/api/v1/platform/extraction/prepare')
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(validRequest);

      // Assert - Exact OpenAPI schema compliance
      expect(response.status).toBe(201);
      const body = response.body;

      // Required fields per OpenAPI spec
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('user_id');
      expect(body).toHaveProperty('source_app_id');
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('target_format');
      expect(body).toHaveProperty('data_summary');
      expect(body).toHaveProperty('created_at');
      expect(body).toHaveProperty('expires_at');

      // Type validation per OpenAPI spec
      expect(typeof body.id).toBe('string');
      expect(body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(typeof body.user_id).toBe('string');
      expect(body.user_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(typeof body.source_app_id).toBe('string');
      expect(['prepared', 'executing', 'completed', 'failed']).toContain(body.status);
      expect(['json', 'csv']).toContain(body.target_format);
      expect(typeof body.data_summary).toBe('object');
      expect(typeof body.created_at).toBe('string');
      expect(new Date(body.created_at).toISOString()).toBe(body.created_at);
      expect(typeof body.expires_at).toBe('string');
      expect(new Date(body.expires_at).toISOString()).toBe(body.expires_at);
    });

    it('should return error matching OpenAPI Error schema', async () => {
      // Arrange - Invalid request to trigger error
      const invalidRequest = {
        user_id: testUserId,
        source_app_id: 'hugo_love',
        target_format: 'invalid_format',
      };

      // Act
      const response = await request(client)
        .post('/api/v1/platform/extraction/prepare')
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
