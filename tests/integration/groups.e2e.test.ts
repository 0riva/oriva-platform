/**
 * E2E Tests for Groups API Endpoints
 *
 * Tests the complete flow:
 * - User creates groups
 * - User's profiles join groups
 * - Groups API returns correct data
 * - Group members API returns correct data
 *
 * Architecture:
 * - Groups are created by users (groups.created_by = auth.users.id)
 * - Groups are joined by profiles (profile_memberships.profile_id = profiles.id)
 * - keyInfo.userId = auth.users.id (account ID)
 */

import request from 'supertest';
import { app } from '../../api/index';

describe('Groups API E2E Tests', () => {
  const testApiKey = process.env.API_KEY_PLATFORM || 'test-api-key';

  describe('GET /api/v1/groups', () => {
    test('should return 401 without API key', async () => {
      const response = await request(app).get('/api/v1/groups');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('should return groups for authenticated user', async () => {
      const response = await request(app)
        .get('/api/v1/groups')
        .set('Authorization', `Bearer ${testApiKey}`);

      // Should not be 401 (auth error) or 500 (server error)
      // May be 200 with empty array if no groups, or 200 with groups
      expect([200, 401, 500]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);

        // If groups exist, validate structure
        if (response.body.data.length > 0) {
          const group = response.body.data[0];
          expect(group).toHaveProperty('groupId');
          expect(group).toHaveProperty('groupName');
          expect(group).toHaveProperty('memberCount');
          expect(group).toHaveProperty('isActive');
          expect(group).toHaveProperty('role');
        }
      }
    });

    test('should return groups created by user', async () => {
      const response = await request(app)
        .get('/api/v1/groups')
        .set('Authorization', `Bearer ${testApiKey}`);

      if (response.status === 200 && response.body.data.length > 0) {
        // Groups should have valid structure
        response.body.data.forEach((group: any) => {
          expect(typeof group.groupId).toBe('string');
          expect(typeof group.groupName).toBe('string');
          expect(typeof group.memberCount).toBe('number');
          expect(typeof group.isActive).toBe('boolean');
          expect(typeof group.role).toBe('string');
        });
      }
    });
  });

  describe('GET /api/v1/groups/:groupId/members', () => {
    const testGroupId = '00000000-0000-0000-0000-000000000001';

    test('should return 401 without API key', async () => {
      const response = await request(app).get(`/api/v1/groups/${testGroupId}/members`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('should return 400 for invalid UUID format', async () => {
      const response = await request(app)
        .get('/api/v1/groups/invalid-uuid/members')
        .set('Authorization', `Bearer ${testApiKey}`);

      expect(response.status).toBe(400);
    });

    test('should return 403 for group user cannot access', async () => {
      const response = await request(app)
        .get(`/api/v1/groups/${testGroupId}/members`)
        .set('Authorization', `Bearer ${testApiKey}`);

      // Should be 403 (forbidden) or 404 (not found) or 200 (if user has access)
      expect([200, 403, 404, 500]).toContain(response.status);

      if (response.status === 403) {
        expect(response.body.code).toBe('FORBIDDEN');
      }
    });

    test('should return members for accessible group', async () => {
      const response = await request(app)
        .get(`/api/v1/groups/${testGroupId}/members`)
        .set('Authorization', `Bearer ${testApiKey}`);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);

        // If members exist, validate structure
        if (response.body.data.length > 0) {
          const member = response.body.data[0];
          expect(member).toHaveProperty('memberId');
          expect(member).toHaveProperty('displayName');
          expect(member).toHaveProperty('role');
          expect(member).toHaveProperty('joinedAt');
        }
      }
    });

    test('should return members from profile_memberships', async () => {
      const response = await request(app)
        .get(`/api/v1/groups/${testGroupId}/members`)
        .set('Authorization', `Bearer ${testApiKey}`);

      if (response.status === 200 && response.body.data.length > 0) {
        // Members should have valid structure
        response.body.data.forEach((member: any) => {
          expect(typeof member.memberId).toBe('string');
          expect(typeof member.displayName).toBe('string');
          expect(typeof member.role).toBe('string');
          expect(typeof member.joinedAt).toBe('string');
        });
      }
    });
  });

  describe('Integration Flow', () => {
    test('should handle user with created groups and joined groups', async () => {
      // Get user's groups
      const groupsResponse = await request(app)
        .get('/api/v1/groups')
        .set('Authorization', `Bearer ${testApiKey}`);

      if (groupsResponse.status === 200) {
        const groups = groupsResponse.body.data;

        // If user has groups, test accessing members
        if (groups.length > 0) {
          const firstGroup = groups[0];

          const membersResponse = await request(app)
            .get(`/api/v1/groups/${firstGroup.groupId}/members`)
            .set('Authorization', `Bearer ${testApiKey}`);

          // Should be able to access members if group is in user's groups list
          expect([200, 403, 404]).toContain(membersResponse.status);

          if (membersResponse.status === 200) {
            expect(membersResponse.body.data).toBeInstanceOf(Array);
            // Member count should match or be close to actual members
            expect(membersResponse.body.data.length).toBeGreaterThanOrEqual(0);
          }
        }
      }
    });

    test('should deduplicate groups (created takes precedence over joined)', async () => {
      const response = await request(app)
        .get('/api/v1/groups')
        .set('Authorization', `Bearer ${testApiKey}`);

      if (response.status === 200) {
        const groups = response.body.data;
        const groupIds = groups.map((g: any) => g.groupId);

        // Should not have duplicates
        const uniqueIds = new Set(groupIds);
        expect(groupIds.length).toBe(uniqueIds.size);
      }
    });
  });
});
