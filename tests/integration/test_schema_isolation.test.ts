/**
 * Integration Test: Multi-Schema Isolation
 * Task: T019
 *
 * TDD Phase: RED - Test written before implementation
 * This test MUST fail initially before implementation
 *
 * Validates that data is properly isolated between app-specific schemas
 * and that X-App-ID header correctly routes to the appropriate schema.
 */

import request from 'supertest';
import { createTestClient } from '../../test-utils/client';
import { mockSupabase } from '../../test-utils/supabase';

describe('Integration: Multi-Schema Isolation', () => {
  let client: any;
  const testUserId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    jest.clearAllMocks();
    client = createTestClient();
  });

  describe('Schema Routing via X-App-ID Header', () => {
    it('should route to hugo_love schema when X-App-ID=hugo_love', async () => {
      // Arrange
      const hugoLoveProfile = {
        user_id: testUserId,
        profile_data: {
          age: 28,
          gender: 'male',
          interests: ['hiking', 'cooking'],
        },
      };

      const mockProfile = {
        id: 'c3a4f7d8-e9b1-4c2a-8f5e-1b3d5f7a9c2e',
        ...hugoLoveProfile,
        app_id: 'hugo_love',
        created_at: '2025-01-02T16:30:00Z',
        updated_at: '2025-01-02T16:30:00Z',
      };

      let schemaSearchPath = '';
      mockSupabase.rpc = jest.fn().mockImplementation((func: string, params: any) => {
        if (func === 'set_schema_path') {
          schemaSearchPath = params.schema_name;
        }
        return Promise.resolve({ data: null, error: null });
      });

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .post('/api/v1/apps/profiles')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(hugoLoveProfile);

      // Assert - Profile created in hugo_love schema
      expect(response.status).toBe(201);
      expect(response.body.app_id).toBe('hugo_love');
      // Implementation should have called set_schema_path('hugo_love')
    });

    it('should route to hugo_career schema when X-App-ID=hugo_career', async () => {
      // Arrange
      const hugoCareerProfile = {
        user_id: testUserId,
        profile_data: {
          current_role: 'Software Engineer',
          skills: ['JavaScript', 'TypeScript'],
        },
      };

      const mockProfile = {
        id: 'd4b5f8e9-f0c2-5d3b-9g6f-2c4e6g8b0d3f',
        ...hugoCareerProfile,
        app_id: 'hugo_career',
        created_at: '2025-01-02T16:30:00Z',
        updated_at: '2025-01-02T16:30:00Z',
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
          }),
        }),
      });

      // Act
      const response = await request(client)
        .post('/api/v1/apps/profiles')
        .set('X-App-ID', 'hugo_career')
        .set('X-API-Key', 'test-api-key')
        .set('Content-Type', 'application/json')
        .send(hugoCareerProfile);

      // Assert - Profile created in hugo_career schema
      expect(response.status).toBe(201);
      expect(response.body.app_id).toBe('hugo_career');
    });
  });

  describe('Data Isolation Between Schemas', () => {
    it('should NOT return hugo_career profile when querying hugo_love schema', async () => {
      // Arrange - User has profile in hugo_career but NOT in hugo_love
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

      // Act - Try to query hugo_love schema
      const response = await request(client)
        .get(`/api/v1/apps/profiles?user_id=${testUserId}`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key');

      // Assert - Should NOT find profile (isolation enforced)
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        code: 'PROFILE_NOT_FOUND',
      });
    });

    it('should isolate sessions between hugo_love and hugo_career', async () => {
      // Arrange - User has sessions in both apps
      const hugoLoveSessions = [
        {
          id: 'session-love-1',
          user_id: testUserId,
          app_id: 'hugo_love',
          session_type: 'coaching',
          started_at: '2025-01-02T15:00:00Z',
        },
      ];

      const hugoCareerSessions = [
        {
          id: 'session-career-1',
          user_id: testUserId,
          app_id: 'hugo_career',
          session_type: 'interview_prep',
          started_at: '2025-01-02T16:00:00Z',
        },
      ];

      // Mock to return different sessions based on X-App-ID
      mockSupabase.from.mockImplementation(() => {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: hugoLoveSessions, // Default to hugo_love
                error: null,
              }),
            }),
          }),
        };
      });

      // Act - Query hugo_love sessions
      const loveResponse = await request(client)
        .get(`/api/v1/hugo-ai/sessions?user_id=${testUserId}`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key');

      // Assert - Only hugo_love sessions returned
      expect(loveResponse.status).toBe(200);
      expect(loveResponse.body.sessions).toHaveLength(1);
      expect(loveResponse.body.sessions[0].app_id).toBe('hugo_love');
      expect(loveResponse.body.sessions[0].id).toBe('session-love-1');
    });

    it('should allow same user_id across different app schemas', async () => {
      // Arrange - User can have profiles in multiple apps
      const createHugoLove = {
        user_id: testUserId,
        profile_data: { age: 28, gender: 'male' },
      };

      const createHugoCareer = {
        user_id: testUserId,
        profile_data: { current_role: 'Engineer' },
      };

      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'profile-1', ...createHugoLove, app_id: 'hugo_love' },
              error: null,
            }),
          }),
        }),
      });

      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'profile-2', ...createHugoCareer, app_id: 'hugo_career' },
              error: null,
            }),
          }),
        }),
      });

      // Act - Create profile in hugo_love
      const loveResponse = await request(client)
        .post('/api/v1/apps/profiles')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .send(createHugoLove);

      // Act - Create profile in hugo_career
      const careerResponse = await request(client)
        .post('/api/v1/apps/profiles')
        .set('X-App-ID', 'hugo_career')
        .set('X-API-Key', 'test-api-key')
        .send(createHugoCareer);

      // Assert - Both succeed with same user_id
      expect(loveResponse.status).toBe(201);
      expect(careerResponse.status).toBe(201);
      expect(loveResponse.body.user_id).toBe(testUserId);
      expect(careerResponse.body.user_id).toBe(testUserId);
      expect(loveResponse.body.id).not.toBe(careerResponse.body.id);
    });
  });

  describe('Hugo AI Schema Routing', () => {
    it('should write sessions to hugo_ai schema regardless of source app', async () => {
      // Arrange
      const hugoLoveSession = {
        session_type: 'coaching',
        context_data: {
          domain: 'dating',
        },
      };

      const mockSession = {
        id: 'session-1',
        user_id: testUserId,
        app_id: 'hugo_love',
        session_type: 'coaching',
        started_at: '2025-01-02T16:30:00Z',
        message_count: 0,
        created_at: '2025-01-02T16:30:00Z',
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockSession,
              error: null,
            }),
          }),
        }),
      });

      // Act - Create session from hugo_love
      const response = await request(client)
        .post('/api/v1/hugo-ai/sessions')
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key')
        .send(hugoLoveSession);

      // Assert - Session written to hugo_ai schema
      expect(response.status).toBe(201);
      expect(response.body.app_id).toBe('hugo_love');
      // Implementation should write to hugo_ai.sessions table
    });

    it('should enforce cross-app insight visibility based on confidence threshold', async () => {
      // Arrange - Insights from multiple apps
      const mockInsights = [
        {
          id: 'insight-1',
          user_id: testUserId,
          insight_type: 'pattern',
          content: 'High confidence insight from hugo_love',
          confidence: 0.88,
          source_app_id: 'hugo_love',
          cross_app_visibility: true,
        },
        {
          id: 'insight-2',
          user_id: testUserId,
          insight_type: 'pattern',
          content: 'Low confidence insight from hugo_love',
          confidence: 0.65,
          source_app_id: 'hugo_love',
          cross_app_visibility: false, // Below 0.7 threshold
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockInsights.filter((i) => i.cross_app_visibility),
              error: null,
            }),
          }),
        }),
      });

      // Act - Query insights from hugo_career (cross-app)
      const response = await request(client)
        .get(`/api/v1/hugo-ai/insights?user_id=${testUserId}`)
        .set('X-App-ID', 'hugo_career')
        .set('X-API-Key', 'test-api-key');

      // Assert - Only high confidence insight visible
      expect(response.status).toBe(200);
      expect(response.body.insights).toHaveLength(1);
      expect(response.body.insights[0].confidence).toBeGreaterThanOrEqual(0.7);
      expect(response.body.insights[0].cross_app_visibility).toBe(true);
    });
  });

  describe('Platform Schema Access', () => {
    it('should access oriva_platform schema for app registration', async () => {
      // Arrange
      const appRegistration = {
        app_id: 'hugo_health',
        name: 'Hugo Health',
        schema_name: 'hugo_health',
      };

      const mockApp = {
        id: 'app-uuid-123',
        ...appRegistration,
        status: 'active',
        created_at: '2025-01-02T16:30:00Z',
        updated_at: '2025-01-02T16:30:00Z',
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            data: [mockApp],
            error: null,
          }),
        }),
      });

      // Act - Register new app (platform operation)
      const response = await request(client)
        .post('/api/v1/platform/apps')
        .set('X-API-Key', 'test-api-key')
        .send(appRegistration);

      // Assert - App registered in oriva_platform schema
      expect(response.status).toBe(201);
      expect(response.body.app_id).toBe('hugo_health');
      // Implementation should write to oriva_platform.apps table
    });

    it('should query user_app_access from oriva_platform schema', async () => {
      // Arrange
      const mockUserApps = [
        {
          app: {
            id: 'app-1',
            app_id: 'hugo_love',
            name: 'Hugo Love',
            schema_name: 'hugo_love',
            status: 'active',
          },
          role: 'user',
          status: 'active',
          joined_at: '2025-01-15T10:00:00Z',
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

      // Act - Query user's apps
      const response = await request(client)
        .get(`/api/v1/platform/users/${testUserId}/apps`)
        .set('X-API-Key', 'test-api-key');

      // Assert - Data from oriva_platform.user_app_access
      expect(response.status).toBe(200);
      expect(response.body.apps).toHaveLength(1);
      // Implementation should query oriva_platform.user_app_access
    });
  });

  describe('Schema Switching Performance', () => {
    it('should maintain sub-100ms response time despite schema switching', async () => {
      // Arrange
      const mockProfile = {
        id: 'profile-1',
        user_id: testUserId,
        app_id: 'hugo_love',
        profile_data: { age: 28 },
        created_at: '2025-01-02T16:30:00Z',
        updated_at: '2025-01-02T16:30:00Z',
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
          }),
        }),
      });

      // Act - Measure response time
      const startTime = Date.now();
      const response = await request(client)
        .get(`/api/v1/apps/profiles?user_id=${testUserId}`)
        .set('X-App-ID', 'hugo_love')
        .set('X-API-Key', 'test-api-key');
      const endTime = Date.now();

      const responseTime = endTime - startTime;

      // Assert - Response within performance target
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(100); // Sub-100ms target
    });
  });
});
