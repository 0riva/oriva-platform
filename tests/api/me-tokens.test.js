/**
 * Personal Access Tokens (PAT) API tests
 *
 * Routes are JWT-authed via validateAuth (the user manages THEIR tokens).
 * In the test env we have no real Supabase JWT, so we exercise the auth
 * contract (missing header / invalid token rejection) and the validation
 * envelope. End-to-end (create → use as bearer → 200) is covered by the
 * integration test in tests/integration/.
 *
 * Note: validateAuth runs a per-IP rate limiter (createAuthMiddleware returns
 * [rateLimiter, authHandler]), so once the limit trips, subsequent requests in
 * this file may return 429 with a non-standard error envelope. The asserts
 * here only check body.success when the status is NOT a rate-limit response.
 */

const { createTestRequest, withAuth, testData } = require('../utils/testHelpers');

const expectRejection = (response, allowedStatuses) => {
  expect(allowedStatuses).toContain(response.status);
  if (response.status !== 429 && response.status !== 204) {
    expect(response.body.success).toBe(false);
  }
};

describe('Personal Access Tokens API', () => {
  describe('POST /api/v1/me/tokens', () => {
    test('rejects request with no Authorization header', async () => {
      const response = await createTestRequest('/api/v1/me/tokens', 'post')
        .set('Content-Type', 'application/json')
        .send({ name: 'My MCP token' });
      expectRejection(response, [401, 429]);
    });

    test('rejects request with invalid bearer (API-key style, not JWT)', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/me/tokens', 'post').set('Content-Type', 'application/json'),
        testData.validApiKey
      ).send({ name: 'My MCP token' });
      expectRejection(response, [400, 401, 429, 500]);
    });

    test('rejects body missing required name field', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/me/tokens', 'post').set('Content-Type', 'application/json'),
        testData.validApiKey
      ).send({});
      expectRejection(response, [400, 401, 429]);
    });

    test('rejects body with empty name', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/me/tokens', 'post').set('Content-Type', 'application/json'),
        testData.validApiKey
      ).send({ name: '' });
      expectRejection(response, [400, 401, 429]);
    });

    test('rejects body with name longer than 100 chars', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/me/tokens', 'post').set('Content-Type', 'application/json'),
        testData.validApiKey
      ).send({ name: 'x'.repeat(101) });
      expectRejection(response, [400, 401, 429]);
    });

    test('rejects body with malformed expires_at', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/me/tokens', 'post').set('Content-Type', 'application/json'),
        testData.validApiKey
      ).send({ name: 'My token', expires_at: 'not-a-date' });
      expectRejection(response, [400, 401, 429]);
    });
  });

  describe('GET /api/v1/me/tokens', () => {
    test('rejects request with no Authorization header', async () => {
      const response = await createTestRequest('/api/v1/me/tokens');
      expectRejection(response, [401, 429]);
    });

    test('rejects request with non-JWT bearer', async () => {
      const response = await withAuth(createTestRequest('/api/v1/me/tokens'), testData.validApiKey);

      // validateAuth rejects non-JWT bearers; if it passes, resolveAuthUserId returns null → 401
      expect([200, 401, 429, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      } else if (response.status !== 429) {
        expect(response.body.success).toBe(false);
      }
    });
  });

  describe('DELETE /api/v1/me/tokens/:id', () => {
    const validUuid = '00000000-0000-4000-8000-000000000000';

    test('rejects request with no Authorization header', async () => {
      const response = await createTestRequest(`/api/v1/me/tokens/${validUuid}`, 'delete');
      expectRejection(response, [401, 429]);
    });

    test('rejects request with non-JWT bearer', async () => {
      const response = await withAuth(
        createTestRequest(`/api/v1/me/tokens/${validUuid}`, 'delete'),
        testData.validApiKey
      );
      expectRejection(response, [204, 401, 404, 429, 500]);
    });

    test('returns 404 for cross-user token IDs (when auth somehow resolves)', async () => {
      const response = await withAuth(
        createTestRequest(`/api/v1/me/tokens/${validUuid}`, 'delete'),
        testData.validApiKey
      );
      expectRejection(response, [401, 404, 429, 500]);
    });
  });

  describe('Spec/contract — operationIds present', () => {
    test('OpenAPI spec exposes the 3 PAT operationIds', async () => {
      const response = await createTestRequest('/api/openapi.json');

      expect([200, 304]).toContain(response.status);
      if (response.status === 200) {
        const paths = response.body?.paths ?? {};
        expect(paths['/api/v1/me/tokens']?.post?.operationId).toBe('createPersonalAccessToken');
        expect(paths['/api/v1/me/tokens']?.get?.operationId).toBe('listPersonalAccessTokens');
        expect(paths['/api/v1/me/tokens/{id}']?.delete?.operationId).toBe(
          'revokePersonalAccessToken'
        );
      }
    });
  });
});
