/**
 * Contract Test: POST /api/v1/platform/extraction/{manifestId}/execute
 * Task: T017
 *
 * TDD Phase: RED - Test written before implementation
 * This test MUST fail initially before implementation
 */

import request from 'supertest';
import { createTestClient } from '../../../test-utils/client';
import { mockSupabase } from '../../../test-utils/supabase';

describe('POST /api/v1/platform/extraction/{manifestId}/execute', () => {
  let client: any;
  const testManifestId = 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e';
  const testUserId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    jest.clearAllMocks();
    client = createTestClient();
  });

  describe('Contract Validation', () => {
    it('should execute data extraction and return download URL', async () => {
      // Arrange
      const mockManifest = {
        id: testManifestId,
        user_id: testUserId,
        source_app_id: 'hugo_love',
        status: 'prepared',
        target_format: 'json',
        data_summary: {
          profiles: 1,
          sessions: 15,
          total_size_bytes: 45678,
        },
        created_at: '2025-01-02T16:30:00Z',
        expires_at: '2025-01-09T16:30:00Z',
      };

      const mockUpdatedManifest = {
        ...mockManifest,
        status: 'completed',
        download_url: 'https://storage.example.com/extractions/user-123/export-abc.json',
        download_expires_at: '2025-01-09T16:30:00Z',
        completed_at: '2025-01-02T16:35:00Z',
      };

      // Mock manifest lookup
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockManifest,
              error: null,
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockUpdatedManifest,
                error: null,
              }),
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .post(`/api/v1/platform/extraction/${testManifestId}/execute`)
        .set('X-API-Key', 'test-api-key');

      // Assert - Contract requirements
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: testManifestId,
        status: 'completed',
        download_url: expect.stringContaining('https://'),
        download_expires_at: expect.any(String),
      });
    });

    it('should validate manifest exists', async () => {
      // Arrange
      const nonExistentManifestId = '999e8400-e29b-41d4-a716-446655440999';

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
        .post(`/api/v1/platform/extraction/${nonExistentManifestId}/execute`)
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        code: 'MANIFEST_NOT_FOUND',
        message: expect.stringContaining('Manifest not found'),
      });
    });

    it('should validate manifest UUID format', async () => {
      // Arrange
      const invalidManifestId = 'not-a-uuid';

      // Act
      const response = await request(client)
        .post(`/api/v1/platform/extraction/${invalidManifestId}/execute`)
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'INVALID_MANIFEST_ID',
        message: expect.stringContaining('Invalid manifest ID format'),
      });
    });

    it('should reject execution of already completed manifest', async () => {
      // Arrange
      const completedManifest = {
        id: testManifestId,
        user_id: testUserId,
        source_app_id: 'hugo_love',
        status: 'completed', // Already completed
        target_format: 'json',
        download_url: 'https://storage.example.com/extractions/existing.json',
        created_at: '2025-01-02T16:30:00Z',
        expires_at: '2025-01-09T16:30:00Z',
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: completedManifest,
              error: null,
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .post(`/api/v1/platform/extraction/${testManifestId}/execute`)
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        code: 'EXTRACTION_ALREADY_COMPLETED',
        message: expect.stringContaining('already been executed'),
      });
    });

    it('should reject execution of expired manifest', async () => {
      // Arrange
      const expiredManifest = {
        id: testManifestId,
        user_id: testUserId,
        source_app_id: 'hugo_love',
        status: 'prepared',
        target_format: 'json',
        created_at: '2025-01-01T00:00:00Z',
        expires_at: '2025-01-01T23:59:59Z', // Expired yesterday
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: expiredManifest,
              error: null,
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .post(`/api/v1/platform/extraction/${testManifestId}/execute`)
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(410);
      expect(response.body).toMatchObject({
        code: 'MANIFEST_EXPIRED',
        message: expect.stringContaining('expired'),
      });
    });

    it('should require API key authentication', async () => {
      // Act - No API key
      const response = await request(client).post(
        `/api/v1/platform/extraction/${testManifestId}/execute`
      );

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'UNAUTHORIZED',
        message: expect.stringContaining('API key'),
      });
    });

    it('should update manifest status to executing then completed', async () => {
      // Arrange
      const preparedManifest = {
        id: testManifestId,
        user_id: testUserId,
        source_app_id: 'hugo_love',
        status: 'prepared',
        target_format: 'json',
        created_at: '2025-01-02T16:30:00Z',
        expires_at: '2025-01-09T16:30:00Z',
      };

      const completedManifest = {
        ...preparedManifest,
        status: 'completed',
        download_url: 'https://storage.example.com/extractions/export.json',
        download_expires_at: '2025-01-09T16:30:00Z',
        completed_at: '2025-01-02T16:35:00Z',
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: preparedManifest,
              error: null,
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: completedManifest,
                error: null,
              }),
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .post(`/api/v1/platform/extraction/${testManifestId}/execute`)
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('completed');
    });

    it('should generate time-limited download URL', async () => {
      // Arrange
      const mockManifest = {
        id: testManifestId,
        user_id: testUserId,
        source_app_id: 'hugo_love',
        status: 'prepared',
        target_format: 'json',
        created_at: '2025-01-02T16:30:00Z',
        expires_at: '2025-01-09T16:30:00Z',
      };

      const completedManifest = {
        ...mockManifest,
        status: 'completed',
        download_url: 'https://storage.example.com/extractions/export-signed-abc.json?expires=123',
        download_expires_at: '2025-01-09T16:30:00Z',
        completed_at: '2025-01-02T16:35:00Z',
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockManifest,
              error: null,
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: completedManifest,
                error: null,
              }),
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .post(`/api/v1/platform/extraction/${testManifestId}/execute`)
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('download_url');
      expect(response.body).toHaveProperty('download_expires_at');
      expect(response.body.download_url).toMatch(/^https:\/\//);
    });

    it('should handle extraction failure gracefully', async () => {
      // Arrange
      const mockManifest = {
        id: testManifestId,
        user_id: testUserId,
        source_app_id: 'hugo_love',
        status: 'prepared',
        target_format: 'json',
        created_at: '2025-01-02T16:30:00Z',
        expires_at: '2025-01-09T16:30:00Z',
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockManifest,
              error: null,
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: {
                  code: 'EXTRACTION_FAILED',
                  message: 'Data extraction failed',
                },
              }),
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .post(`/api/v1/platform/extraction/${testManifestId}/execute`)
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        code: 'EXTRACTION_FAILED',
        message: expect.stringContaining('extraction failed'),
      });
    });

    it('should support both JSON and CSV exports', async () => {
      const formats = ['json', 'csv'];

      for (const format of formats) {
        // Arrange
        const mockManifest = {
          id: testManifestId,
          user_id: testUserId,
          source_app_id: 'hugo_love',
          status: 'prepared',
          target_format: format,
          created_at: '2025-01-02T16:30:00Z',
          expires_at: '2025-01-09T16:30:00Z',
        };

        const completedManifest = {
          ...mockManifest,
          status: 'completed',
          download_url: `https://storage.example.com/extractions/export.${format}`,
          download_expires_at: '2025-01-09T16:30:00Z',
          completed_at: '2025-01-02T16:35:00Z',
        };

        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockManifest,
                error: null,
              }),
            }),
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: completedManifest,
                  error: null,
                }),
              }),
            }),
          }),
        });

        // Act
        const response = await request(client)
          .post(`/api/v1/platform/extraction/${testManifestId}/execute`)
          .set('X-API-Key', 'test-api-key');

        // Assert
        expect(response.status).toBe(200);
        expect(response.body.download_url).toContain(`.${format}`);
      }
    });
  });

  describe('OpenAPI Contract Compliance', () => {
    it('should match OpenAPI schema for successful response', async () => {
      // Arrange
      const mockManifest = {
        id: testManifestId,
        user_id: testUserId,
        source_app_id: 'hugo_love',
        status: 'prepared',
        target_format: 'json',
        data_summary: {
          profiles: 1,
          sessions: 20,
          total_size_bytes: 67890,
        },
        created_at: '2025-01-02T16:30:00Z',
        expires_at: '2025-01-09T16:30:00Z',
      };

      const completedManifest = {
        ...mockManifest,
        status: 'completed',
        download_url: 'https://storage.example.com/extractions/user-123/export-xyz.json',
        download_expires_at: '2025-01-09T16:30:00Z',
        completed_at: '2025-01-02T16:35:00Z',
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockManifest,
              error: null,
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: completedManifest,
                error: null,
              }),
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .post(`/api/v1/platform/extraction/${testManifestId}/execute`)
        .set('X-API-Key', 'test-api-key');

      // Assert - Exact OpenAPI schema compliance
      expect(response.status).toBe(200);
      const body = response.body;

      // Required fields per OpenAPI spec
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('download_url');
      expect(body).toHaveProperty('download_expires_at');

      // Type validation per OpenAPI spec
      expect(typeof body.id).toBe('string');
      expect(body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(body.status).toBe('completed');
      expect(typeof body.download_url).toBe('string');
      expect(body.download_url).toMatch(/^https:\/\//);
      expect(typeof body.download_expires_at).toBe('string');
      expect(new Date(body.download_expires_at).toISOString()).toBe(body.download_expires_at);

      // Optional completed_at field
      if (body.completed_at) {
        expect(typeof body.completed_at).toBe('string');
        expect(new Date(body.completed_at).toISOString()).toBe(body.completed_at);
      }
    });

    it('should return error matching OpenAPI Error schema', async () => {
      // Arrange - Invalid manifest ID to trigger error
      const invalidManifestId = 'invalid-uuid-format';

      // Act
      const response = await request(client)
        .post(`/api/v1/platform/extraction/${invalidManifestId}/execute`)
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
