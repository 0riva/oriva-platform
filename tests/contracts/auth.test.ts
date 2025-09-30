// Task: T017-T022 - Authentication API contract tests
// Description: TDD contract tests for auth endpoints (must fail before implementation)
// Dependencies: OpenAPI spec at specs/003-hugo-platform-integration/contracts/hugo-auth-api.yaml

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';

// Test server will be started before tests
const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

describe('Authentication API Contracts', () => {
  let testUserId: string;
  let testAccessToken: string;
  let testRefreshToken: string;

  // Test data
  const testUser = {
    email: 'test@example.com',
    password: 'SecureP@ssw0rd123',
    name: 'Test User',
  };

  describe('POST /api/v1/auth/register - T017', () => {
    it('should register a new user with valid data', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/auth/register')
        .send({
          email: testUser.email,
          password: testUser.password,
          name: testUser.name,
        })
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email', testUser.email);
      expect(response.body.user).toHaveProperty('subscription_tier', 'free');
      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('refresh_token');
      expect(response.body).toHaveProperty('expires_in');

      // Save for subsequent tests
      testUserId = response.body.user.id;
      testAccessToken = response.body.access_token;
      testRefreshToken = response.body.refresh_token;
    });

    it('should reject registration with missing email', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/auth/register')
        .send({
          password: testUser.password,
          name: testUser.name,
        })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should reject registration with invalid email format', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/auth/register')
        .send({
          email: 'invalid-email',
          password: testUser.password,
          name: testUser.name,
        })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should reject registration with weak password', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/auth/register')
        .send({
          email: 'newuser@example.com',
          password: '123',
          name: testUser.name,
        })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/password/i);
    });

    it('should reject duplicate email registration', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/auth/register')
        .send({
          email: testUser.email, // Already registered
          password: testUser.password,
          name: 'Another User',
        })
        .expect('Content-Type', /json/)
        .expect(409);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'USER_EXISTS');
    });
  });

  describe('POST /api/v1/auth/login - T018', () => {
    it('should login with valid credentials', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id', testUserId);
      expect(response.body.user).toHaveProperty('email', testUser.email);
      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('refresh_token');
      expect(response.body).toHaveProperty('expires_in');
    });

    it('should reject login with invalid email', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testUser.password,
        })
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'INVALID_CREDENTIALS');
    });

    it('should reject login with invalid password', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123',
        })
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'INVALID_CREDENTIALS');
    });

    it('should reject login with missing credentials', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/auth/login')
        .send({})
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/auth/profile - T019', () => {
    it('should get user profile with valid token', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('id', testUserId);
      expect(response.body).toHaveProperty('email', testUser.email);
      expect(response.body).toHaveProperty('subscription_tier', 'free');
      expect(response.body).toHaveProperty('preferences');
      expect(response.body).toHaveProperty('data_retention_days', 365);
      expect(response.body).toHaveProperty('created_at');
    });

    it('should reject profile request without token', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/v1/auth/profile')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'AUTH_MISSING');
    });

    it('should reject profile request with invalid token', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/v1/auth/profile')
        .set('Authorization', 'Bearer invalid-token-xyz')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'AUTH_INVALID');
    });
  });

  describe('PUT /api/v1/auth/profile - T019', () => {
    it('should update user preferences', async () => {
      const response = await request(API_BASE_URL)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .send({
          preferences: {
            notifications: true,
            theme: 'dark',
          },
          data_retention_days: 730,
        })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('preferences.notifications', true);
      expect(response.body).toHaveProperty('preferences.theme', 'dark');
      expect(response.body).toHaveProperty('data_retention_days', 730);
    });

    it('should reject invalid data_retention_days', async () => {
      const response = await request(API_BASE_URL)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .send({
          data_retention_days: 10, // Below minimum of 30
        })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/token/refresh - T020', () => {
    it('should refresh access token with valid refresh token', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/auth/token/refresh')
        .send({
          refresh_token: testRefreshToken,
        })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('expires_in');

      // Update token for subsequent tests
      testAccessToken = response.body.access_token;
    });

    it('should reject refresh with invalid token', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/auth/token/refresh')
        .send({
          refresh_token: 'invalid-refresh-token',
        })
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'INVALID_REFRESH_TOKEN');
    });

    it('should reject refresh with missing token', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/auth/token/refresh')
        .send({})
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/logout - T021', () => {
    it('should logout user with valid token', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .expect(204);

      expect(response.body).toEqual({});
    });

    it('should reject logout without token', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/auth/logout')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'AUTH_MISSING');
    });

    it('should handle logout with already logged out token gracefully', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .expect(204);

      expect(response.body).toEqual({});
    });
  });

  describe('DELETE /api/v1/auth/account - T022', () => {
    it('should require password confirmation', async () => {
      // Re-login to get fresh token
      const loginResponse = await request(API_BASE_URL)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      testAccessToken = loginResponse.body.access_token;

      const response = await request(API_BASE_URL)
        .delete('/api/v1/auth/account')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .send({
          password: testUser.password,
        })
        .expect(204);

      expect(response.body).toEqual({});
    });

    it('should reject account deletion with incorrect password', async () => {
      const response = await request(API_BASE_URL)
        .delete('/api/v1/auth/account')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .send({
          password: 'WrongPassword',
        })
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'INVALID_CREDENTIALS');
    });

    it('should reject account deletion without authentication', async () => {
      const response = await request(API_BASE_URL)
        .delete('/api/v1/auth/account')
        .send({
          password: testUser.password,
        })
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'AUTH_MISSING');
    });

    it('should verify account deletion cascades to all user data', async () => {
      // After deletion, login should fail
      const response = await request(API_BASE_URL)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'INVALID_CREDENTIALS');
    });
  });

  describe('Rate Limiting - T017-T022', () => {
    it('should enforce rate limits for unauthenticated users', async () => {
      // Free tier: 5 requests per minute
      const requests = Array.from({ length: 6 }, () =>
        request(API_BASE_URL)
          .post('/api/v1/auth/login')
          .send({ email: 'test@example.com', password: 'test' })
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter((r) => r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
      expect(rateLimited[0].body).toHaveProperty('code', 'RATE_LIMIT_EXCEEDED');
      expect(rateLimited[0].headers).toHaveProperty('retry-after');
    });
  });
});