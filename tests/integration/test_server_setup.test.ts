/**
 * Integration Test: Server Setup
 *
 * Validates that the multi-tenant server initializes correctly
 * and all routes are registered.
 */

import { createApp } from '../../api/server';
import request from 'supertest';

describe('Multi-Tenant Server Setup', () => {
  let app: any;

  beforeAll(() => {
    app = createApp();
  });

  describe('Server Initialization', () => {
    it('should create Express app successfully', () => {
      expect(app).toBeDefined();
      expect(typeof app.listen).toBe('function');
    });

    it('should respond to health check', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.version).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Platform Routes Registration', () => {
    it('should have POST /api/v1/platform/apps endpoint', async () => {
      const response = await request(app)
        .post('/api/v1/platform/apps')
        .send({});

      // Should get 401 (no API key) rather than 404 (route not found)
      expect(response.status).not.toBe(404);
    });

    it('should have GET /api/v1/platform/apps endpoint', async () => {
      const response = await request(app).get('/api/v1/platform/apps');

      // Should get 401 (no API key) rather than 404 (route not found)
      expect(response.status).not.toBe(404);
    });

    it('should have GET /api/v1/platform/users/:userId/apps endpoint', async () => {
      const response = await request(app).get(
        '/api/v1/platform/users/00000000-0000-0000-0000-000000000001/apps'
      );

      // Should get 401 (no API key) rather than 404 (route not found)
      expect(response.status).not.toBe(404);
    });

    it('should have POST /api/v1/platform/extraction/prepare endpoint', async () => {
      const response = await request(app).post('/api/v1/platform/extraction/prepare').send({});

      // Should get 401 (no API key) rather than 404 (route not found)
      expect(response.status).not.toBe(404);
    });
  });

  describe('Hugo AI Routes Registration', () => {
    it('should have POST /api/v1/hugo-ai/sessions endpoint', async () => {
      const response = await request(app)
        .post('/api/v1/hugo-ai/sessions')
        .set('X-App-ID', 'hugo_love')
        .send({});

      // Should get 401 or 500 (missing context) rather than 404
      expect(response.status).not.toBe(404);
    });

    it('should have GET /api/v1/hugo-ai/insights endpoint', async () => {
      const response = await request(app)
        .get('/api/v1/hugo-ai/insights')
        .set('X-App-ID', 'hugo_love');

      // Should get 401 or 500 (missing context) rather than 404
      expect(response.status).not.toBe(404);
    });
  });

  describe('App Routes Registration', () => {
    it('should have POST /api/v1/apps/profiles endpoint', async () => {
      const response = await request(app)
        .post('/api/v1/apps/profiles')
        .set('X-App-ID', 'hugo_love')
        .send({});

      // Should get 401 or 500 (missing context) rather than 404
      expect(response.status).not.toBe(404);
    });

    it('should have GET /api/v1/apps/ice-breakers endpoint', async () => {
      const response = await request(app)
        .get('/api/v1/apps/ice-breakers')
        .set('X-App-ID', 'hugo_love');

      // Should get 401 or 500 (missing context) rather than 404
      expect(response.status).not.toBe(404);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for undefined routes', async () => {
      const response = await request(app).get('/api/v1/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('NOT_FOUND');
    });

    it('should handle errors with proper JSON format', async () => {
      const response = await request(app).get('/api/v1/platform/apps');

      expect(response.body).toHaveProperty('code');
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app).get('/health');

      // Helmet should add these headers
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
    });
  });
});
