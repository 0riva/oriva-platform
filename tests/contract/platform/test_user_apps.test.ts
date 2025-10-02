/**
 * Contract Test: GET /api/v1/platform/users/{userId}/apps
 * Task: T008
 *
 * TDD Phase: RED - Test written before implementation
 * This test MUST fail initially before implementation
 */

import request from 'supertest';
import { createTestClient } from '../../../test-utils/client';
import { mockSupabase } from '../../../test-utils/supabase';

describe('GET /api/v1/platform/users/{userId}/apps', () => {
  let client: any;
  const testUserId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    jest.clearAllMocks();
    client = createTestClient();
  });

  describe('Contract Validation', () => {
    it("should return user's accessible apps with roles", async () => {
      // Arrange
      const mockUserApps = [
        {
          app: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            app_id: 'hugo_love',
            name: 'Hugo Love',
            description: 'Dating coach app',
            schema_name: 'hugo_love',
            status: 'active',
            settings: {
              features: ['coaching', 'profile_optimization'],
            },
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
          },
          role: 'user',
          status: 'active',
          joined_at: '2025-01-15T10:00:00Z',
          last_active_at: '2025-01-20T14:30:00Z',
          settings: {
            notifications_enabled: true,
            theme: 'dark',
          },
        },
        {
          app: {
            id: '223e4567-e89b-12d3-a456-426614174001',
            app_id: 'hugo_career',
            name: 'Hugo Career',
            description: 'Career development coach',
            schema_name: 'hugo_career',
            status: 'active',
            settings: {
              features: ['interview_prep', 'resume_review'],
            },
            created_at: '2025-01-02T00:00:00Z',
            updated_at: '2025-01-02T00:00:00Z',
          },
          role: 'admin',
          status: 'active',
          joined_at: '2025-01-10T08:00:00Z',
          last_active_at: '2025-01-19T16:45:00Z',
          settings: {
            notifications_enabled: false,
          },
        },
      ];

      // Mock the join query for user_app_access with apps
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockUserApps,
              error: null,
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .get(`/api/v1/platform/users/${testUserId}/apps`)
        .set('X-API-Key', 'test-api-key');

      // Assert - Contract requirements
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('apps');
      expect(Array.isArray(response.body.apps)).toBe(true);
      expect(response.body.apps).toHaveLength(2);

      // Validate structure
      const firstApp = response.body.apps[0];
      expect(firstApp).toMatchObject({
        app: {
          id: expect.any(String),
          app_id: expect.any(String),
          name: expect.any(String),
          schema_name: expect.any(String),
          status: expect.stringMatching(/^(active|inactive|extracting)$/),
        },
        role: expect.stringMatching(/^(user|admin|owner)$/),
        joined_at: expect.any(String),
      });
    });

    it('should filter by app status when provided', async () => {
      // Arrange
      const activeApps = [
        {
          app: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            app_id: 'hugo_love',
            name: 'Hugo Love',
            schema_name: 'hugo_love',
            status: 'active',
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
          },
          role: 'user',
          status: 'active',
          joined_at: '2025-01-15T10:00:00Z',
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: activeApps,
                error: null,
              }),
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .get(`/api/v1/platform/users/${testUserId}/apps?status=active`)
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.apps).toHaveLength(1);
      expect(response.body.apps[0].status).toBe('active');
    });

    it('should return 404 for non-existent user', async () => {
      // Arrange
      const nonExistentUserId = '999e8400-e29b-41d4-a716-446655440999';

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
        .get(`/api/v1/platform/users/${nonExistentUserId}/apps`)
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        code: 'USER_NOT_FOUND',
        message: expect.stringContaining('User not found'),
      });
    });

    it('should validate UUID format for userId', async () => {
      // Arrange
      const invalidUserId = 'not-a-uuid';

      // Act
      const response = await request(client)
        .get(`/api/v1/platform/users/${invalidUserId}/apps`)
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'INVALID_USER_ID',
        message: expect.stringContaining('Invalid user ID format'),
      });
    });

    it('should require API key authentication', async () => {
      // Act - No API key
      const response = await request(client).get(`/api/v1/platform/users/${testUserId}/apps`);

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'UNAUTHORIZED',
        message: expect.stringContaining('API key'),
      });
    });

    it('should include only active user-app relationships by default', async () => {
      // Arrange
      const userAppsWithMixed = [
        {
          app: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            app_id: 'hugo_love',
            name: 'Hugo Love',
            schema_name: 'hugo_love',
            status: 'active',
          },
          role: 'user',
          status: 'active',
          joined_at: '2025-01-15T10:00:00Z',
        },
        // Suspended and deleted relationships filtered out
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: userAppsWithMixed,
                error: null,
              }),
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .get(`/api/v1/platform/users/${testUserId}/apps`)
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.apps).toHaveLength(1);
      expect(response.body.apps.every((a: any) => a.status === 'active')).toBe(true);
    });
  });

  describe('OpenAPI Contract Compliance', () => {
    it('should match OpenAPI schema for successful response', async () => {
      // Arrange
      const mockUserApps = [
        {
          app: {
            id: 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e',
            app_id: 'hugo_love',
            name: 'Hugo Love',
            description: 'Dating coach',
            schema_name: 'hugo_love',
            status: 'active',
            settings: {
              quotas: {
                max_users: 10000,
              },
              features: ['coaching'],
            },
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
          },
          role: 'user',
          status: 'active',
          joined_at: '2025-01-15T10:00:00Z',
          last_active_at: '2025-01-20T14:30:00Z',
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockUserApps,
              error: null,
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .get(`/api/v1/platform/users/${testUserId}/apps`)
        .set('X-API-Key', 'test-api-key');

      // Assert - Exact OpenAPI schema compliance
      expect(response.status).toBe(200);
      const body = response.body;

      // Response wrapper
      expect(body).toHaveProperty('apps');
      expect(Array.isArray(body.apps)).toBe(true);

      // Validate each user-app relationship
      body.apps.forEach((item: any) => {
        // App object validation
        expect(item).toHaveProperty('app');
        const app = item.app;
        expect(app).toHaveProperty('id');
        expect(app).toHaveProperty('app_id');
        expect(app).toHaveProperty('name');
        expect(app).toHaveProperty('schema_name');
        expect(app).toHaveProperty('status');

        // Type validation for app
        expect(typeof app.id).toBe('string');
        expect(app.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        expect(['active', 'inactive', 'extracting']).toContain(app.status);

        // User-app relationship fields
        expect(item).toHaveProperty('role');
        expect(item).toHaveProperty('joined_at');
        expect(typeof item.role).toBe('string');
        expect(['user', 'admin', 'owner']).toContain(item.role);
        expect(typeof item.joined_at).toBe('string');
        expect(new Date(item.joined_at).toISOString()).toBe(item.joined_at);

        // Optional fields
        if (item.last_active_at !== undefined) {
          expect(typeof item.last_active_at).toBe('string');
          expect(new Date(item.last_active_at).toISOString()).toBe(item.last_active_at);
        }

        if (item.settings !== undefined) {
          expect(typeof item.settings).toBe('object');
        }
      });
    });

    it('should return error matching OpenAPI Error schema', async () => {
      // Arrange - Invalid userId to trigger error
      const invalidUserId = 'invalid-uuid-format';

      // Act
      const response = await request(client)
        .get(`/api/v1/platform/users/${invalidUserId}/apps`)
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
