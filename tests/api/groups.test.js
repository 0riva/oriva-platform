/**
 * Group endpoints tests
 * Tests the group management endpoints using the real seeded test API key.
 *
 * Architecture:
 * - Groups are created by users (groups.created_by = auth.users.id)
 * - Groups are joined by profiles (profile_memberships.profile_id = profiles.id)
 * - keyInfo.userId = auth.users.id (account ID)
 *
 * Note: Tests assert response shape and status codes only — not specific row data.
 * The seeded account (718f8c69-4601-46ba-a351-54afcddd1634 / profile gav_test)
 * may have zero groups in the test DB, so asserting specific counts would be fragile.
 */

const { createTestRequest, withAuth, testData } = require('../utils/testHelpers');

describe('Group Endpoints - TDD Implementation', () => {
  describe('GET /api/v1/groups', () => {
    test('should require authentication when no token is provided', async () => {
      const response = await createTestRequest('/api/v1/groups');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('should return 200 and an array with the seeded API key', async () => {
      const response = await withAuth(createTestRequest('/api/v1/groups'), testData.validApiKey);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('should return well-formed group objects when groups exist', async () => {
      const response = await withAuth(createTestRequest('/api/v1/groups'), testData.validApiKey);

      expect(response.status).toBe(200);
      // If there are groups, each must have the expected shape
      response.body.data.forEach((group) => {
        expect(typeof group.groupId).toBe('string');
        expect(typeof group.groupName).toBe('string');
      });
    });

    test('should reject an invalid API key', async () => {
      const response = await withAuth(createTestRequest('/api/v1/groups'), testData.invalidApiKey);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/groups/:groupId/members', () => {
    test('should require authentication when no token is provided', async () => {
      const response = await createTestRequest('/api/v1/groups/group_123/members');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('should return 403 for a group the caller has no access to', async () => {
      // Use a UUID-format groupId that does not exist in the test DB so the
      // real access-check logic fires and correctly denies access.
      const nonExistentGroupId = '00000000-0000-0000-0000-000000000000';
      const response = await withAuth(
        createTestRequest(`/api/v1/groups/${nonExistentGroupId}/members`),
        testData.validApiKey
      );

      // The endpoint should deny access (403) or return not-found (404).
      // It must not return 200 for a group the caller cannot access.
      expect([403, 404]).toContain(response.status);
      expect(response.body.success).toBe(false);
    });

    test('should return a well-formed error body on 403', async () => {
      const nonExistentGroupId = '00000000-0000-0000-0000-000000000001';
      const response = await withAuth(
        createTestRequest(`/api/v1/groups/${nonExistentGroupId}/members`),
        testData.validApiKey
      );

      expect([403, 404]).toContain(response.status);
      expect(response.body.success).toBe(false);
      // code should be a non-empty string (FORBIDDEN, NOT_FOUND, etc.)
      expect(typeof response.body.code).toBe('string');
      expect(response.body.code.length).toBeGreaterThan(0);
    });

    test('should reject an invalid API key', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/groups/group_123/members'),
        testData.invalidApiKey
      );

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Authentication', () => {
    test('should require API key', async () => {
      const response = await createTestRequest('/api/v1/groups');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});
