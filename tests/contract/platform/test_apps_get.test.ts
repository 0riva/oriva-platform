/**
 * Contract Test: GET /api/v1/platform/apps
 * Task: T007
 *
 * TDD Phase: RED - Test written before implementation
 * This test MUST fail initially before implementation
 */

import request from 'supertest';
import { createTestClient } from '../../../test-utils/client';
import { mockSupabase } from '../../../test-utils/supabase';

describe('GET /api/v1/platform/apps', () => {
  let client: any;

  beforeEach(() => {
    jest.clearAllMocks();
    client = createTestClient();
  });

  describe('Contract Validation', () => {
    it('should return list of available apps', async () => {
      // Arrange
      const mockApps = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          app_id: 'hugo_love',
          name: 'Hugo Love',
          description: 'AI-powered dating coach',
          schema_name: 'hugo_love',
          status: 'active',
          settings: {
            quotas: {
              max_users: 10000,
              max_storage_gb: 100,
            },
            features: ['dating_coach', 'profile_optimization', 'chat_practice'],
          },
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
        {
          id: '223e4567-e89b-12d3-a456-426614174001',
          app_id: 'hugo_career',
          name: 'Hugo Career',
          description: 'Career development AI coach',
          schema_name: 'hugo_career',
          status: 'active',
          settings: {
            quotas: {
              max_users: 5000,
              max_storage_gb: 50,
            },
            features: ['interview_prep', 'resume_review', 'career_planning'],
          },
          created_at: '2025-01-02T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: mockApps,
            error: null,
          }),
        }),
      });

      // Act
      const response = await request(client)
        .get('/api/v1/platform/apps')
        .set('X-API-Key', 'test-api-key');

      // Assert - Contract requirements
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('apps');
      expect(Array.isArray(response.body.apps)).toBe(true);
      expect(response.body.apps).toHaveLength(2);

      // Validate first app structure
      const firstApp = response.body.apps[0];
      expect(firstApp).toMatchObject({
        id: expect.any(String),
        app_id: expect.any(String),
        name: expect.any(String),
        schema_name: expect.any(String),
        status: expect.stringMatching(/^(active|inactive|extracting)$/),
      });
    });

    it('should filter apps by status when provided', async () => {
      // Arrange
      const activeApps = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          app_id: 'hugo_love',
          name: 'Hugo Love',
          schema_name: 'hugo_love',
          status: 'active',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: activeApps,
              error: null,
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .get('/api/v1/platform/apps?status=active')
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.apps).toHaveLength(1);
      expect(response.body.apps[0].status).toBe('active');
    });

    it('should require API key authentication', async () => {
      // Act - No API key
      const response = await request(client).get('/api/v1/platform/apps');

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'UNAUTHORIZED',
        message: expect.stringContaining('API key'),
      });
    });

    it('should handle empty app list', async () => {
      // Arrange
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

      // Act
      const response = await request(client)
        .get('/api/v1/platform/apps')
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        apps: [],
      });
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: null,
            error: {
              code: 'PGRST000',
              message: 'Database connection error',
            },
          }),
        }),
      });

      // Act
      const response = await request(client)
        .get('/api/v1/platform/apps')
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        code: 'INTERNAL_ERROR',
        message: expect.any(String),
      });
    });

    it('should support pagination parameters', async () => {
      // Arrange
      const paginatedApps = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          app_id: 'hugo_love',
          name: 'Hugo Love',
          schema_name: 'hugo_love',
          status: 'active',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          range: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: paginatedApps,
              error: null,
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .get('/api/v1/platform/apps?limit=10&offset=0')
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.apps).toHaveLength(1);
    });
  });

  describe('OpenAPI Contract Compliance', () => {
    it('should match OpenAPI schema for successful response', async () => {
      // Arrange
      const mockApps = [
        {
          id: 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e',
          app_id: 'hugo_love',
          name: 'Hugo Love',
          description: 'Dating coach app',
          schema_name: 'hugo_love',
          status: 'active',
          settings: {
            quotas: {
              max_users: 10000,
              max_storage_gb: 100,
              max_api_calls: 1000000,
            },
            features: ['coaching', 'analysis'],
            personality_id: 'dating_coach_v1',
          },
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: mockApps,
            error: null,
          }),
        }),
      });

      // Act
      const response = await request(client)
        .get('/api/v1/platform/apps')
        .set('X-API-Key', 'test-api-key');

      // Assert - Exact OpenAPI schema compliance
      expect(response.status).toBe(200);
      const body = response.body;

      // Response wrapper
      expect(body).toHaveProperty('apps');
      expect(Array.isArray(body.apps)).toBe(true);

      // Validate each app in array
      body.apps.forEach((app: any) => {
        // Required fields per OpenAPI spec
        expect(app).toHaveProperty('id');
        expect(app).toHaveProperty('app_id');
        expect(app).toHaveProperty('name');
        expect(app).toHaveProperty('schema_name');
        expect(app).toHaveProperty('status');

        // Type validation per OpenAPI spec
        expect(typeof app.id).toBe('string');
        expect(app.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        expect(typeof app.app_id).toBe('string');
        expect(typeof app.name).toBe('string');
        expect(typeof app.schema_name).toBe('string');
        expect(['active', 'inactive', 'extracting']).toContain(app.status);

        // Optional fields validation when present
        if (app.description !== undefined) {
          expect(typeof app.description).toBe('string');
        }

        if (app.settings) {
          expect(typeof app.settings).toBe('object');

          if (app.settings.quotas) {
            expect(typeof app.settings.quotas).toBe('object');
          }

          if (app.settings.features) {
            expect(Array.isArray(app.settings.features)).toBe(true);
            app.settings.features.forEach((feature: any) => {
              expect(typeof feature).toBe('string');
            });
          }

          if (app.settings.personality_id !== undefined) {
            expect(typeof app.settings.personality_id).toBe('string');
          }
        }
      });
    });

    it('should return error matching OpenAPI Error schema on failure', async () => {
      // Arrange - Force an error scenario
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      // Act
      const response = await request(client)
        .get('/api/v1/platform/apps')
        .set('X-API-Key', 'test-api-key');

      // Assert - Error schema per OpenAPI spec
      expect(response.status).toBeGreaterThanOrEqual(400);
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
