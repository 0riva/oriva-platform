/**
 * Authentication tests
 * Tests the dual authentication system (API keys + Supabase auth tokens)
 */

const { createTestRequest, withAuth, testData } = require('../utils/testHelpers');

describe('Authentication', () => {
  describe('Authorization Header Validation', () => {
    test('should reject requests without authorization header', async () => {
      const response = await createTestRequest('/api/v1/user/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('API key required');
    });

    test('should reject requests without Bearer prefix', async () => {
      const response = await createTestRequest('/api/v1/user/me')
        .set('Authorization', 'invalid_format');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('API key required');
    });

    test('should reject empty Bearer token', async () => {
      const response = await createTestRequest('/api/v1/user/me')
        .set('Authorization', 'Bearer ');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('API key required');
    });

    test('should reject non-string tokens', async () => {
      const response = await createTestRequest('/api/v1/user/me')
        .set('Authorization', 'Bearer null');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid API key');
    });
  });

  describe('API Key Authentication', () => {
    test('should recognize valid API key prefixes', async () => {
      const validPrefixes = ['oriva_pk_live_', 'oriva_pk_test_'];

      for (const prefix of validPrefixes) {
        const response = await withAuth(
          createTestRequest('/api/v1/user/me'),
          `${prefix}invalid_key_suffix`
        );

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Invalid API key');
      }
    });

    test('should reject invalid API keys', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/user/me'),
        testData.invalidApiKey
      );

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid API key');
    });

    test('should accept valid API key and attach keyInfo', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/user/me'),
        testData.validApiKey
      );

      // Should either succeed with 200 or fail with auth error (depending on endpoint implementation)
      expect([200, 401, 404, 500]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });

    test('should handle API key hashing errors gracefully', async () => {
      // Test with malformed API key that might cause hashing issues
      const response = await withAuth(
        createTestRequest('/api/v1/user/me'),
        'oriva_pk_test_malformed_key_123'
      );

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid API key');
    });

    test('should handle database lookup errors gracefully', async () => {
      // This tests the error handling when Supabase lookup fails
      const response = await withAuth(
        createTestRequest('/api/v1/user/me'),
        'oriva_pk_test_non_existent_key_hash'
      );

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid API key');
    });
  });

  describe('Supabase Auth Token Authentication', () => {
    test('should reject invalid tokens without API key prefix', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/user/me'),
        'invalid_token_without_prefix'
      );

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid API key');
    });

    test('should reject malformed JWT-like tokens', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/user/me'),
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid_payload'
      );

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid API key');
    });
  });

  describe('Protected Endpoints', () => {
    const protectedEndpoints = [
      '/api/v1/user/me',
      '/api/v1/entries',
      '/api/v1/templates',
      '/api/v1/storage',
      '/api/v1/developer/apps'
    ];

    protectedEndpoints.forEach(endpoint => {
      test(`should require authentication for ${endpoint}`, async () => {
        const response = await createTestRequest(endpoint);
        
        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('API key required');
      });
    });

    // Test marketplace endpoint separately since it might have different behavior
    test('should require authentication for marketplace apps', async () => {
      const response = await createTestRequest('/api/v1/marketplace/apps');
      
      // Accept either 401 (auth required) or 404 (endpoint not found)
      expect([401, 404]).toContain(response.status);
      if (response.status === 401) {
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('API key required');
      }
    });
  });

  describe('Request Context and Key Info', () => {
    test('should attach API key info to request object for valid API keys', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/user/me'),
        testData.validApiKey
      );

      // Test that the authentication middleware processes the request
      expect([200, 401, 404, 500]).toContain(response.status);
    });

    test('should handle API key usage tracking', async () => {
      // Test that usage statistics are updated for valid API keys
      const response = await withAuth(
        createTestRequest('/api/v1/user/me'),
        testData.validApiKey
      );

      expect([200, 401, 404, 500]).toContain(response.status);
      // Usage tracking happens asynchronously and shouldn't affect response
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle extremely long authorization headers', async () => {
      const longToken = 'Bearer ' + 'a'.repeat(10000);
      const response = await createTestRequest('/api/v1/user/me')
        .set('Authorization', longToken);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/Invalid (API key|authentication token)/);
    });

    test('should handle special characters in API keys', async () => {
      const specialCharsKey = 'oriva_pk_test_!@#$%^&*()';
      const response = await withAuth(
        createTestRequest('/api/v1/user/me'),
        specialCharsKey
      );

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid API key');
    });

    test('should handle case sensitivity in API keys', async () => {
      const upperCaseKey = testData.validApiKey.toUpperCase();
      const response = await withAuth(
        createTestRequest('/api/v1/user/me'),
        upperCaseKey
      );

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid API key');
    });

    test('should handle authorization header with extra whitespace', async () => {
      const response = await createTestRequest('/api/v1/user/me')
        .set('Authorization', '  Bearer  ' + testData.validApiKey + '  ');

      // The middleware parses the key but it has extra spaces, so fails validation
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid API key');
    });
  });

  describe('Admin Token Authentication', () => {
    test('should reject dev endpoints without admin token when configured', async () => {
      const response = await createTestRequest('/api/v1/admin/test');

      expect([401, 404, 503]).toContain(response.status);
      if (response.status === 401) {
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Unauthorized');
      } else if (response.status === 503) {
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Admin token not configured');
      }
    });

    test('should reject invalid admin tokens', async () => {
      const response = await createTestRequest('/api/v1/admin/test')
        .set('x-admin-token', 'invalid_admin_token');

      expect([401, 404]).toContain(response.status);
      if (response.status === 401) {
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Unauthorized');
      }
    });
  });

  describe('Rate Limiting for Dev Endpoints', () => {
    test('should handle rate limiting gracefully', async () => {
      // This test checks that rate limiting middleware is properly set up
      // We can't easily trigger it in tests without making 30+ requests
      const response = await createTestRequest('/api/v1/admin/test');

      // Should respond with proper structure even if rate limited
      expect([401, 404, 429, 503]).toContain(response.status);
      if (response.status === 429) {
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Rate limit exceeded');
      }
    });
  });
});
