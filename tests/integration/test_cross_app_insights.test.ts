/**
 * Integration Test: Cross-App Insights with 0.7 Confidence Threshold
 * Task: T020 & T020a
 *
 * TDD Phase: RED - Test written before implementation
 * This test MUST fail initially before implementation
 *
 * Validates cross-app intelligence sharing and foreign key relationships
 * across schema boundaries (oriva_platform -> hugo_ai -> app-specific).
 */

import request from 'supertest';
import { createTestClient } from '../../test-utils/client';
import { mockSupabase } from '../../test-utils/supabase';

describe('Integration: Cross-App Insights & Cross-Schema Foreign Keys', () => {
  let client: any;
  const testUserId = '550e8400-e29b-41d4-a716-446655440000';
  const hugoLoveAppId = '123e4567-e89b-12d3-a456-426614174000';
  const hugoCareerAppId = '223e4567-e89b-12d3-a456-426614174001';

  beforeEach(() => {
    jest.clearAllMocks();
    client = createTestClient();
  });

  describe('Cross-App Intelligence with 0.7 Confidence Threshold', () => {
    it('should share insights from hugo_love to hugo_career when confidence >= 0.7', async () => {
      // Arrange - Create high confidence insight in hugo_love
      const highConfidenceInsight = {
        user_id: testUserId,
        insight_type: 'pattern',
        content: 'User demonstrates strong communication skills',
        confidence: 0.85, // Above 0.7 threshold
        source_app_id: 'hugo_love',
        supporting_data: {
          communication_analysis: {
            clarity: 0.88,
            empathy: 0.92,
            active_listening: 0.85,
          },
        },
      };

      const mockInsight = {
        id: 'insight-1',
        ...highConfidenceInsight,
        cross_app_visibility: true,
        created_at: '2025-01-02T16:30:00Z',
      };

      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockInsight,
              error: null,
            }),
          }),
        }),
      });

      // Act - Create insight from hugo_love
      const createResponse = await request(client)
        .post('/api/v1/hugo-ai/insights')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .send(highConfidenceInsight);

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.cross_app_visibility).toBe(true);

      // Arrange - Query from hugo_career
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [mockInsight],
              error: null,
            }),
          }),
        }),
      });

      // Act - Retrieve insights from hugo_career
      const queryResponse = await request(client)
        .get(`/api/v1/hugo-ai/insights?user_id=${testUserId}`)
        .set('X-App-ID', 'hugo_career')
        .set('X-API-Key', 'test-api-key');

      // Assert - Hugo Career can see hugo_love insight
      expect(queryResponse.status).toBe(200);
      expect(queryResponse.body.insights).toHaveLength(1);
      expect(queryResponse.body.insights[0].source_app_id).toBe('hugo_love');
      expect(queryResponse.body.insights[0].confidence).toBe(0.85);
      expect(queryResponse.body.insights[0].cross_app_visibility).toBe(true);
    });

    it('should NOT share insights below 0.7 confidence threshold', async () => {
      // Arrange - Create low confidence insight in hugo_love
      const lowConfidenceInsight = {
        user_id: testUserId,
        insight_type: 'pattern',
        content: 'Tentative observation about user preferences',
        confidence: 0.65, // Below 0.7 threshold
        source_app_id: 'hugo_love',
      };

      const mockInsight = {
        id: 'insight-2',
        ...lowConfidenceInsight,
        cross_app_visibility: false, // Should be false
        created_at: '2025-01-02T16:30:00Z',
      };

      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockInsight,
              error: null,
            }),
          }),
        }),
      });

      // Act - Create low confidence insight
      const createResponse = await request(client)
        .post('/api/v1/hugo-ai/insights')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .send(lowConfidenceInsight);

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.cross_app_visibility).toBe(false);

      // Arrange - Query from hugo_career (should not include low confidence)
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [], // No insights visible
              error: null,
            }),
          }),
        }),
      });

      // Act - Try to retrieve from hugo_career
      const queryResponse = await request(client)
        .get(`/api/v1/hugo-ai/insights?user_id=${testUserId}`)
        .set('X-App-ID', 'hugo_career')
        .set('X-API-Key', 'test-api-key');

      // Assert - Low confidence insight NOT visible
      expect(queryResponse.status).toBe(200);
      expect(queryResponse.body.insights).toHaveLength(0);
    });

    it('should filter insights by min_confidence parameter', async () => {
      // Arrange - Multiple insights with varying confidence
      const mockInsights = [
        {
          id: 'insight-1',
          user_id: testUserId,
          insight_type: 'pattern',
          content: 'Very high confidence insight',
          confidence: 0.92,
          source_app_id: 'hugo_love',
          cross_app_visibility: true,
        },
        {
          id: 'insight-2',
          user_id: testUserId,
          insight_type: 'recommendation',
          content: 'High confidence recommendation',
          confidence: 0.78,
          source_app_id: 'hugo_love',
          cross_app_visibility: true,
        },
        {
          id: 'insight-3',
          user_id: testUserId,
          insight_type: 'pattern',
          content: 'Medium confidence pattern',
          confidence: 0.72,
          source_app_id: 'hugo_career',
          cross_app_visibility: true,
        },
      ];

      // Filter for confidence >= 0.8
      const highConfidenceInsights = mockInsights.filter((i) => i.confidence >= 0.8);

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: highConfidenceInsights,
                error: null,
              }),
            }),
          }),
        }),
      });

      // Act - Query with min_confidence filter
      const response = await request(client)
        .get(`/api/v1/hugo-ai/insights?user_id=${testUserId}&min_confidence=0.8`)
        .set('X-App-ID', 'hugo_career')
        .set('X-API-Key', 'test-api-key');

      // Assert - Only insights >= 0.8 returned
      expect(response.status).toBe(200);
      expect(response.body.insights).toHaveLength(2);
      expect(response.body.insights.every((i: any) => i.confidence >= 0.8)).toBe(true);
    });

    it('should aggregate insights from multiple apps for same user', async () => {
      // Arrange - User has insights from multiple apps
      const mockInsights = [
        {
          id: 'insight-love-1',
          user_id: testUserId,
          insight_type: 'pattern',
          content: 'Dating communication pattern',
          confidence: 0.85,
          source_app_id: 'hugo_love',
          cross_app_visibility: true,
        },
        {
          id: 'insight-career-1',
          user_id: testUserId,
          insight_type: 'pattern',
          content: 'Professional communication pattern',
          confidence: 0.88,
          source_app_id: 'hugo_career',
          cross_app_visibility: true,
        },
        {
          id: 'insight-love-2',
          user_id: testUserId,
          insight_type: 'recommendation',
          content: 'Dating recommendation',
          confidence: 0.78,
          source_app_id: 'hugo_love',
          cross_app_visibility: true,
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

      // Act - Query all insights (cross-app view)
      const response = await request(client)
        .get(`/api/v1/hugo-ai/insights?user_id=${testUserId}`)
        .set('X-App-ID', 'hugo_career')
        .set('X-API-Key', 'test-api-key');

      // Assert - All high-confidence insights from all apps
      expect(response.status).toBe(200);
      expect(response.body.insights).toHaveLength(3);

      const sourceApps = response.body.insights.map((i: any) => i.source_app_id);
      expect(sourceApps).toContain('hugo_love');
      expect(sourceApps).toContain('hugo_career');
    });
  });

  describe('Cross-Schema Foreign Key Relationships (T020a)', () => {
    it('should enforce foreign key from hugo_ai.sessions to oriva_platform.users', async () => {
      // Arrange - Try to create session for non-existent user
      const nonExistentUserId = '999e8400-e29b-41d4-a716-446655440999';
      const sessionRequest = {
        session_type: 'coaching',
        context_data: {},
      };

      // Mock foreign key violation
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: {
                code: '23503', // Foreign key violation
                message:
                  'insert or update on table "sessions" violates foreign key constraint "sessions_user_id_fkey"',
              },
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .post('/api/v1/hugo-ai/sessions')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .send({
          ...sessionRequest,
          user_id: nonExistentUserId,
        });

      // Assert - Foreign key violation prevents creation
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'FOREIGN_KEY_VIOLATION',
        message: expect.stringContaining('user does not exist'),
      });
    });

    it('should enforce foreign key from hugo_ai.sessions to oriva_platform.apps', async () => {
      // Arrange - Try to create session for non-existent app
      const nonExistentAppId = 'non_existent_app';
      const sessionRequest = {
        session_type: 'coaching',
        context_data: {},
      };

      // Mock foreign key violation
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: {
                code: '23503', // Foreign key violation
                message:
                  'insert or update on table "sessions" violates foreign key constraint "sessions_app_id_fkey"',
              },
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .post('/api/v1/hugo-ai/sessions')
        .set('X-App-ID', nonExistentAppId)
        .set('X-API-Key', 'test-api-key')
        .send(sessionRequest);

      // Assert - Foreign key violation prevents creation
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'FOREIGN_KEY_VIOLATION',
        message: expect.stringContaining('app does not exist'),
      });
    });

    it('should enforce foreign key from app_schema.profiles to oriva_platform.users', async () => {
      // Arrange - Try to create profile for non-existent user
      const nonExistentUserId = '999e8400-e29b-41d4-a716-446655440999';
      const profileRequest = {
        user_id: nonExistentUserId,
        profile_data: {
          age: 28,
        },
      };

      // Mock foreign key violation
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: {
                code: '23503', // Foreign key violation
                message:
                  'insert or update on table "profiles" violates foreign key constraint "profiles_user_id_fkey"',
              },
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .post('/api/v1/apps/profiles')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .send(profileRequest);

      // Assert - Foreign key violation prevents creation
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'FOREIGN_KEY_VIOLATION',
        message: expect.stringContaining('user does not exist'),
      });
    });

    it('should enforce foreign key from hugo_ai.insights to hugo_ai.sessions', async () => {
      // Arrange - Try to create insight for non-existent session
      const nonExistentSessionId = '999e4567-e89b-12d3-a456-426614174999';
      const insightRequest = {
        user_id: testUserId,
        session_id: nonExistentSessionId,
        insight_type: 'pattern',
        content: 'Some insight',
        confidence: 0.85,
      };

      // Mock foreign key violation
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: {
                code: '23503', // Foreign key violation
                message:
                  'insert or update on table "insights" violates foreign key constraint "insights_session_id_fkey"',
              },
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .post('/api/v1/hugo-ai/insights')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .send(insightRequest);

      // Assert - Foreign key violation prevents creation
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'FOREIGN_KEY_VIOLATION',
        message: expect.stringContaining('session does not exist'),
      });
    });

    it('should cascade delete sessions when user is deleted', async () => {
      // Arrange - Delete user with existing sessions
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
            sessions: 15, // Sessions in app schema
          },
          hugo_ai: {
            sessions: 15, // Sessions in hugo_ai schema - cascade deleted
            insights: 8, // Insights also cascade deleted
          },
        },
        total_records_deleted: 41,
        confirmation_token: 'del_cascade_test',
      };

      mockSupabase.rpc = jest.fn().mockResolvedValue({
        data: mockDeletionSummary,
        error: null,
      });

      // Act - Delete user
      const response = await request(client)
        .delete(`/api/v1/platform/users/${testUserId}/delete`)
        .set('X-API-Key', 'test-api-key');

      // Assert - Cascade deletion occurred
      expect(response.status).toBe(200);
      expect(response.body.deletion_summary.hugo_ai.sessions).toBe(15);
      expect(response.body.deletion_summary.hugo_ai.insights).toBe(8);
      expect(response.body.total_records_deleted).toBe(41);
    });

    it('should maintain referential integrity across schema boundaries', async () => {
      // Arrange - Create user, app, profile, session, insight in sequence
      const userId = testUserId;
      const appId = hugoLoveAppId;

      // Mock successful creation with foreign keys satisfied
      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'profile-1',
                user_id: userId,
                app_id: 'hugo_love',
                profile_data: {},
              },
              error: null,
            }),
          }),
        }),
      });

      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'session-1',
                user_id: userId,
                app_id: appId,
                session_type: 'coaching',
              },
              error: null,
            }),
          }),
        }),
      });

      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'insight-1',
                user_id: userId,
                session_id: 'session-1',
                insight_type: 'pattern',
                content: 'Test',
                confidence: 0.85,
              },
              error: null,
            }),
          }),
        }),
      });

      // Act - Create profile
      const profileResponse = await request(client)
        .post('/api/v1/apps/profiles')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .send({ user_id: userId, profile_data: {} });

      // Act - Create session
      const sessionResponse = await request(client)
        .post('/api/v1/hugo-ai/sessions')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .send({ session_type: 'coaching', context_data: {} });

      // Act - Create insight
      const insightResponse = await request(client)
        .post('/api/v1/hugo-ai/insights')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .send({
          user_id: userId,
          session_id: 'session-1',
          insight_type: 'pattern',
          content: 'Test insight',
          confidence: 0.85,
        });

      // Assert - All creations succeed (foreign keys satisfied)
      expect(profileResponse.status).toBe(201);
      expect(sessionResponse.status).toBe(201);
      expect(insightResponse.status).toBe(201);
    });
  });
});
