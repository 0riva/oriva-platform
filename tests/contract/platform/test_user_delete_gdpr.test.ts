/**
 * Contract Test: DELETE /api/v1/platform/users/{userId}/delete
 * Task: T018
 *
 * TDD Phase: RED - Test written before implementation
 * This test MUST fail initially before implementation
 *
 * GDPR Right to Erasure (Art. 17) - User data deletion across all apps
 */

import request from 'supertest';
import { createTestClient } from '../../../test-utils/client';
import { mockSupabase } from '../../../test-utils/supabase';

describe('DELETE /api/v1/platform/users/{userId}/delete', () => {
  let client: any;
  const testUserId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    jest.clearAllMocks();
    client = createTestClient();
  });

  describe('Contract Validation - GDPR Compliance', () => {
    it('should delete user data across all apps and schemas', async () => {
      // Arrange
      const mockDeletionSummary = {
        user_id: testUserId,
        deleted_at: '2025-01-02T16:30:00Z',
        apps_processed: ['hugo_love', 'hugo_career'],
        deletion_summary: {
          oriva_platform: {
            users: 1,
            user_app_access: 2,
          },
          hugo_love: {
            profiles: 1,
            sessions: 15,
            insights: 8,
          },
          hugo_career: {
            profiles: 1,
            sessions: 3,
            insights: 2,
          },
          hugo_ai: {
            sessions: 18,
            insights: 10,
          },
        },
        total_records_deleted: 61,
        confirmation_token: 'del_c3a4f7d8e9b1',
      };

      // Mock successful deletion
      mockSupabase.rpc = jest.fn().mockResolvedValue({
        data: mockDeletionSummary,
        error: null,
      });

      // Act
      const response = await request(client)
        .delete(`/api/v1/platform/users/${testUserId}/delete`)
        .set('X-API-Key', 'test-api-key');

      // Assert - Contract requirements
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        user_id: testUserId,
        deleted_at: expect.any(String),
        apps_processed: expect.arrayContaining(['hugo_love']),
        deletion_summary: expect.objectContaining({
          oriva_platform: expect.any(Object),
          hugo_ai: expect.any(Object),
        }),
        total_records_deleted: expect.any(Number),
      });
    });

    it('should validate user exists before deletion', async () => {
      // Arrange
      const nonExistentUserId = '999e8400-e29b-41d4-a716-446655440999';

      mockSupabase.rpc = jest.fn().mockResolvedValue({
        data: null,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User does not exist',
        },
      });

      // Act
      const response = await request(client)
        .delete(`/api/v1/platform/users/${nonExistentUserId}/delete`)
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        code: 'USER_NOT_FOUND',
        message: expect.stringContaining('User not found'),
      });
    });

    it('should validate userId UUID format', async () => {
      // Arrange
      const invalidUserId = 'not-a-uuid';

      // Act
      const response = await request(client)
        .delete(`/api/v1/platform/users/${invalidUserId}/delete`)
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
      const response = await request(client).delete(
        `/api/v1/platform/users/${testUserId}/delete`
      );

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'UNAUTHORIZED',
        message: expect.stringContaining('API key'),
      });
    });

    it('should cascade delete across all schemas (oriva_platform, hugo_ai, app-specific)', async () => {
      // Arrange
      const mockDeletionSummary = {
        user_id: testUserId,
        deleted_at: '2025-01-02T16:30:00Z',
        apps_processed: ['hugo_love'],
        deletion_summary: {
          oriva_platform: {
            users: 1,
            user_app_access: 1,
          },
          hugo_love: {
            profiles: 1,
            sessions: 10,
            messages: 150,
          },
          hugo_ai: {
            sessions: 10,
            insights: 5,
          },
        },
        total_records_deleted: 178,
        confirmation_token: 'del_abc123xyz',
      };

      mockSupabase.rpc = jest.fn().mockResolvedValue({
        data: mockDeletionSummary,
        error: null,
      });

      // Act
      const response = await request(client)
        .delete(`/api/v1/platform/users/${testUserId}/delete`)
        .set('X-API-Key', 'test-api-key');

      // Assert - Verify all schemas included
      expect(response.status).toBe(200);
      expect(response.body.deletion_summary).toHaveProperty('oriva_platform');
      expect(response.body.deletion_summary).toHaveProperty('hugo_ai');
      expect(response.body.deletion_summary).toHaveProperty('hugo_love');
    });

    it('should provide detailed deletion summary per schema', async () => {
      // Arrange
      const detailedSummary = {
        user_id: testUserId,
        deleted_at: '2025-01-02T16:30:00Z',
        apps_processed: ['hugo_love', 'hugo_career'],
        deletion_summary: {
          oriva_platform: {
            users: 1,
            user_app_access: 2,
            user_settings: 1,
          },
          hugo_love: {
            profiles: 1,
            sessions: 15,
            insights: 8,
            ice_breakers: 10,
            messages: 225,
          },
          hugo_career: {
            profiles: 1,
            sessions: 5,
            insights: 3,
            career_assessments: 2,
          },
          hugo_ai: {
            sessions: 20,
            insights: 11,
            cross_app_insights: 4,
          },
        },
        total_records_deleted: 309,
        confirmation_token: 'del_xyz789abc',
      };

      mockSupabase.rpc = jest.fn().mockResolvedValue({
        data: detailedSummary,
        error: null,
      });

      // Act
      const response = await request(client)
        .delete(`/api/v1/platform/users/${testUserId}/delete`)
        .set('X-API-Key', 'test-api-key');

      // Assert - Detailed breakdown per schema
      expect(response.status).toBe(200);

      const hugoDeletion = response.body.deletion_summary.hugo_love;
      expect(hugoDeletion).toMatchObject({
        profiles: 1,
        sessions: 15,
        insights: 8,
        ice_breakers: 10,
        messages: 225,
      });

      const platformDeletion = response.body.deletion_summary.oriva_platform;
      expect(platformDeletion).toMatchObject({
        users: 1,
        user_app_access: 2,
      });
    });

    it('should return confirmation token for audit trail', async () => {
      // Arrange
      const mockDeletionSummary = {
        user_id: testUserId,
        deleted_at: '2025-01-02T16:30:00Z',
        apps_processed: ['hugo_love'],
        deletion_summary: {
          oriva_platform: { users: 1 },
        },
        total_records_deleted: 25,
        confirmation_token: 'del_confirm_abc123xyz789',
      };

      mockSupabase.rpc = jest.fn().mockResolvedValue({
        data: mockDeletionSummary,
        error: null,
      });

      // Act
      const response = await request(client)
        .delete(`/api/v1/platform/users/${testUserId}/delete`)
        .set('X-API-Key', 'test-api-key');

      // Assert - Confirmation token for GDPR audit
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('confirmation_token');
      expect(response.body.confirmation_token).toMatch(/^del_/);
    });

    it('should handle partial deletion failure gracefully', async () => {
      // Arrange - Some schemas deleted, but one failed
      mockSupabase.rpc = jest.fn().mockResolvedValue({
        data: null,
        error: {
          code: 'PARTIAL_DELETION_FAILURE',
          message: 'Failed to delete from hugo_career schema',
          details: {
            failed_schemas: ['hugo_career'],
            successful_schemas: ['oriva_platform', 'hugo_love', 'hugo_ai'],
          },
        },
      });

      // Act
      const response = await request(client)
        .delete(`/api/v1/platform/users/${testUserId}/delete`)
        .set('X-API-Key', 'test-api-key');

      // Assert
      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        code: 'PARTIAL_DELETION_FAILURE',
        message: expect.stringContaining('Failed to delete'),
        details: expect.objectContaining({
          failed_schemas: expect.arrayContaining(['hugo_career']),
        }),
      });
    });

    it('should be idempotent - handle already deleted user gracefully', async () => {
      // Arrange - User already deleted
      mockSupabase.rpc = jest.fn().mockResolvedValue({
        data: {
          user_id: testUserId,
          deleted_at: '2025-01-02T16:30:00Z',
          apps_processed: [],
          deletion_summary: {},
          total_records_deleted: 0,
          confirmation_token: 'del_already_deleted',
        },
        error: null,
      });

      // Act
      const response = await request(client)
        .delete(`/api/v1/platform/users/${testUserId}/delete`)
        .set('X-API-Key', 'test-api-key');

      // Assert - Should succeed with 0 records deleted
      expect(response.status).toBe(200);
      expect(response.body.total_records_deleted).toBe(0);
    });

    it('should delete user data within 30 days per GDPR Art. 17', async () => {
      // Arrange
      const mockDeletionSummary = {
        user_id: testUserId,
        deleted_at: '2025-01-02T16:30:00Z',
        apps_processed: ['hugo_love'],
        deletion_summary: {
          oriva_platform: { users: 1 },
        },
        total_records_deleted: 50,
        confirmation_token: 'del_gdpr_compliant',
        compliance_notes: 'Deleted within 30-day GDPR requirement',
      };

      mockSupabase.rpc = jest.fn().mockResolvedValue({
        data: mockDeletionSummary,
        error: null,
      });

      // Act
      const response = await request(client)
        .delete(`/api/v1/platform/users/${testUserId}/delete`)
        .set('X-API-Key', 'test-api-key');

      // Assert - Immediate deletion (complies with 30-day max)
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('deleted_at');

      // Verify deletion is immediate
      const deletedTime = new Date(response.body.deleted_at);
      const now = new Date();
      const timeDiffMinutes = (now.getTime() - deletedTime.getTime()) / (1000 * 60);

      expect(timeDiffMinutes).toBeLessThan(5); // Deleted within 5 minutes
    });

    it('should support dry_run parameter for preview', async () => {
      // Arrange
      const dryRunSummary = {
        user_id: testUserId,
        dry_run: true,
        apps_to_process: ['hugo_love', 'hugo_career'],
        estimated_deletion_summary: {
          oriva_platform: { users: 1, user_app_access: 2 },
          hugo_love: { profiles: 1, sessions: 15, insights: 8 },
          hugo_career: { profiles: 1, sessions: 3 },
          hugo_ai: { sessions: 18, insights: 11 },
        },
        estimated_total_records: 60,
      };

      mockSupabase.rpc = jest.fn().mockResolvedValue({
        data: dryRunSummary,
        error: null,
      });

      // Act
      const response = await request(client)
        .delete(`/api/v1/platform/users/${testUserId}/delete?dry_run=true`)
        .set('X-API-Key', 'test-api-key');

      // Assert - Preview without actual deletion
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('dry_run', true);
      expect(response.body).toHaveProperty('estimated_deletion_summary');
      expect(response.body).not.toHaveProperty('confirmation_token'); // Not deleted
    });
  });

  describe('OpenAPI Contract Compliance', () => {
    it('should match OpenAPI schema for successful response', async () => {
      // Arrange
      const mockDeletionSummary = {
        user_id: testUserId,
        deleted_at: '2025-01-02T16:30:00Z',
        apps_processed: ['hugo_love'],
        deletion_summary: {
          oriva_platform: {
            users: 1,
            user_app_access: 1,
          },
          hugo_love: {
            profiles: 1,
            sessions: 12,
            insights: 6,
          },
          hugo_ai: {
            sessions: 12,
            insights: 6,
          },
        },
        total_records_deleted: 39,
        confirmation_token: 'del_compliance_token_xyz',
      };

      mockSupabase.rpc = jest.fn().mockResolvedValue({
        data: mockDeletionSummary,
        error: null,
      });

      // Act
      const response = await request(client)
        .delete(`/api/v1/platform/users/${testUserId}/delete`)
        .set('X-API-Key', 'test-api-key');

      // Assert - Exact OpenAPI schema compliance
      expect(response.status).toBe(200);
      const body = response.body;

      // Required fields per OpenAPI spec
      expect(body).toHaveProperty('user_id');
      expect(body).toHaveProperty('deleted_at');
      expect(body).toHaveProperty('apps_processed');
      expect(body).toHaveProperty('deletion_summary');
      expect(body).toHaveProperty('total_records_deleted');
      expect(body).toHaveProperty('confirmation_token');

      // Type validation per OpenAPI spec
      expect(typeof body.user_id).toBe('string');
      expect(body.user_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(typeof body.deleted_at).toBe('string');
      expect(new Date(body.deleted_at).toISOString()).toBe(body.deleted_at);
      expect(Array.isArray(body.apps_processed)).toBe(true);
      expect(typeof body.deletion_summary).toBe('object');
      expect(typeof body.total_records_deleted).toBe('number');
      expect(typeof body.confirmation_token).toBe('string');

      // Deletion summary structure
      expect(body.deletion_summary).toHaveProperty('oriva_platform');
      expect(body.deletion_summary).toHaveProperty('hugo_ai');

      // Validate deletion counts are numbers
      Object.values(body.deletion_summary).forEach((schemaSummary: any) => {
        expect(typeof schemaSummary).toBe('object');
        Object.values(schemaSummary).forEach((count: any) => {
          expect(typeof count).toBe('number');
          expect(count).toBeGreaterThanOrEqual(0);
        });
      });
    });

    it('should return error matching OpenAPI Error schema', async () => {
      // Arrange - Invalid user_id to trigger error
      const invalidUserId = 'invalid-uuid-format';

      // Act
      const response = await request(client)
        .delete(`/api/v1/platform/users/${invalidUserId}/delete`)
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
